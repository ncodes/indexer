import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import { makeSession } from '../auth/utils';
import { randStr } from '../../common/common';
import { OfferService } from './offer.service';
import { OfferController } from './offers.controller';
import Offer from '../../models/offers';
import * as moment from 'moment';

describe('OffersController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [OfferController],
      providers: [OfferService],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  let token: string;
  const net = 'ethereum';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(u, randStr(), '5', 'secret');
  });

  describe('.get', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/0x123`)
        .query({ net: 'net1' })
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when offer was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/0`)
        .query({ net })
        .send({})
        .expect(404)
        .expect({ error: { message: 'market not found' } });
    });

    it('should return 200 when offer exists', async () => {
      const offer = await Offer.create({
        network: net,
        offerId: 1,
      });
      await request(app.getHttpServer())
        .get(`/v1/offers/${offer.offerId}`)
        .query({ net })
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(offer.id);
        });
    });
  });

  describe('.list', function () {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net: 'net1' })
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and empty data when no offer exists', async () => {
      await request(app.getHttpServer()).get(`/v1/offers`).query({ net }).send({}).expect(200).expect({
        data: [],
      });
    });

    it('should return 200 and correct data when [query=creator] is set', async () => {
      const offer = await Offer.create({ network: net, creator: '0xCreator' });
      await Offer.create({ network: net, creator: '0xCreator2' });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, creator: offer.creator })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [query=creator] is set', async () => {
      const offer = await Offer.create({ network: net, marketAddress: '0xMarket' });
      await Offer.create({ network: net, marketAddress: '0xMarket2' });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, marketAddress: offer.marketAddress })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [query=provider] is set', async () => {
      const offer = await Offer.create({ network: net, provider: '0xProvider' });
      await Offer.create({ network: net, provider: '0xProvider2' });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, provider: offer.provider })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [query=lid] is set', async () => {
      const offer = await Offer.create({ network: net, lid: 2 });
      await Offer.create({ network: net, lid: 1 });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, lid: offer.lid })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [query=provider,lid] are set', async () => {
      await Offer.create({ network: net, lid: 2 });
      await Offer.create({ network: net, provider: '0xProvider', lid: 1 });
      const offer = await Offer.create({ network: net, provider: '0xProvider', lid: 3 });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, provider: offer.provider, lid: offer.lid })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct count when [query=count] is set', async () => {
      await Offer.create({ network: net, lid: 2 });
      await Offer.create({ network: net, provider: '0xProvider', lid: 1 });
      const offer = await Offer.create({ network: net, provider: '0xProvider', lid: 3 });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, provider: offer.provider, lid: offer.lid, count: true })
        .expect(200)
        .expect({ data: { count: '1' } });
    });

    it('should return 200 and correct data when [query=limit] is set', async () => {
      await Offer.create({ network: net, lid: 2 });
      await Offer.create({ network: net, provider: '0xProvider', lid: 1 });
      await Offer.create({ network: net, provider: '0xProvider', lid: 3 });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, limit: 2 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
        });
    });

    it('should return 200 and correct data when [query=limit,offset] is set', async () => {
      const now = moment();
      await Offer.create({ network: net, lid: 2, updatedAt: now.toISOString() });
      const offer = await Offer.create({
        network: net,
        provider: '0xProvider',
        lid: 1,
        updatedAt: now.add(1, 's').toISOString(),
      });
      const offer2 = await Offer.create({
        network: net,
        provider: '0xProvider',
        lid: 3,
        updatedAt: now.add(2, 's').toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, limit: 1, offset: 0 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer2.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, limit: 1, offset: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });
  });
});

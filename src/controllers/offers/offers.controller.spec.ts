import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/DBService';
import Event, { Events } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import Offer from '../../models/offer';
import User from '../../models/user';
import { MetadataService } from '../../services/metadata/metadata.service';
import { makeSession } from '../auth/utils';
import { MarketService } from '../markets/market.service';
import { OfferService } from './offer.service';
import { OfferController } from './offers.controller';

const mockMarketService = jest.fn().mockImplementation(() => ({
  extendMarket: jest.fn(),
}));

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockTryToUsd = jest.fn();
const mockMetadataService = jest.fn().mockImplementation(() => ({
  tryToUsd: mockTryToUsd,
}));

describe('OffersController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};
  const net = 'ethereum';
  const address = '0xAddress';
  const address2 = '0xAddress2';
  const provider = '0xProvider';
  const provider2 = '0xProvider2';
  const provider3 = '0xProvider3';
  const marketAddress = '0xMarket';

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

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [OfferController],
      providers: [OfferService, MarketService, MetadataService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MarketService)
      .useValue(new mockMarketService())
      .overrideProvider(MetadataService)
      .useValue(new mockMetadataService())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  let token: string;

  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address });
    token = await makeSession(u, randStr(), '5', cfgObj['auth.jwtSecret']);
  });

  beforeEach(async () => {
    await Market.create({
      network: net,
      address: marketAddress,
      baseAddress: '0xBase',
      quoteAddress: '0xQuote',
    });
    await Liquidity.create({ network: net, marketAddress, provider, lid: 1 });
    await Liquidity.create({ network: net, marketAddress, provider: provider2, lid: 2 });
    await Liquidity.create({ network: net, marketAddress, provider: provider3, lid: 3 });
  });

  describe('.events', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/O/events`)
        .query({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/O/events`)
        .query({ net: 'net1' })
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when offer ID is invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/O/events`)
        .query({ net })
        .expect(400)
        .expect({
          error: {
            message: 'must be a number',
            param: 'offerId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and correct result', async () => {
      const event = await Event.create({
        network: net,
        offerId: 1,
        createdAt: moment().subtract(1, 's').toISOString(),
        action: Events.OfferCreate,
      });
      const event2 = await Event.create({
        network: net,
        offerId: 1,
        createdAt: moment().toISOString(),
        action: Events.OfferCreate,
      });
      await Event.create({ network: 'other', offerId: 1, createdAt: moment().subtract(1, 's').toISOString() });
      await Event.create({ network: 'other', offerId: 1, createdAt: moment().toISOString() });
      await request(app.getHttpServer())
        .get(`/v1/offers/1/events`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(event2.id);
          expect(res.body.data[1].id).toEqual(event.id);
        });
    });

    it('should return 200 and correct result when limit and offset are set', async () => {
      const event = await Event.create({
        network: net,
        offerId: 1,
        createdAt: moment().subtract(1, 's').toISOString(),
        action: Events.OfferCreate,
      });
      const event2 = await Event.create({
        network: net,
        offerId: 1,
        createdAt: moment().toISOString(),
        action: Events.OfferCreate,
      });
      await Event.create({ network: 'other', offerId: 1, createdAt: moment().subtract(1, 's').toISOString() });
      await Event.create({ network: 'other', offerId: 1, createdAt: moment().toISOString() });

      await request(app.getHttpServer())
        .get(`/v1/offers/1/events`)
        .query({ net, limit: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(event2.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/offers/1/events`)
        .query({ net, limit: 1, offset: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(event.id);
        });
    });
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
        .expect({ error: { message: 'offer not found' } });
    });

    it('should return 200 when offer exists', async () => {
      const offer = await Offer.create({
        network: net,
        offerId: 1,
        provider,
        lid: 1,
        marketAddress,
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
      const offer = await Offer.create({ network: net, provider, lid: 1, creator: '0xCreator', marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2, creator: '0xCreator2', marketAddress });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, creator: offer.creator })
        .expect(200)
        .expect((res) => {
          console.log(res.body);
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [query=marketAddress] is set', async () => {
      const offer = await Offer.create({ network: net, marketAddress, provider, lid: 1 });
      await Offer.create({ network: net, marketAddress: '0xMarket2', provider, lid: 1 });

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
      const offer = await Offer.create({ network: net, provider: provider, lid: 1, marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });

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
      const offer = await Offer.create({ network: net, provider, lid: 1, marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2 });

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
      await Offer.create({ network: net, provider, lid: 1, marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
      const offer = await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, provider: offer.provider, lid: offer.lid })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });
    });

    it('should return 200 and correct data when [creatorOrProvider] is set', async () => {
      await Offer.create({ network: net, lid: 1, provider: provider, marketAddress });
      await Offer.create({ network: net, lid: 2, provider: provider2, creator: provider, marketAddress });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, creatorOrProvider: provider })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
        });
    });

    it('should return 200 and correct `priceUsd` value', async () => {
      await Offer.create({ network: net, lid: 1, provider: provider, marketAddress, price: '10' });
      mockTryToUsd.mockResolvedValue(100);

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].priceUsd).toEqual(100);
          expect(mockTryToUsd).toBeCalledWith(net, '10', '0xQuote');
        });
    });

    it('should return 200 and correct `amountUsd` value', async () => {
      await Offer.create({ network: net, lid: 1, provider: provider, marketAddress, amount: '10' });
      mockTryToUsd.mockResolvedValue(100);

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].amountUsd).toEqual(100);
          expect(mockTryToUsd).toBeCalledWith(net, '10', '0xBase');
        });
    });

    describe('status was set', () => {
      it('should return 200 and correct data when [status=accepted] is set', async () => {
        mockTryToUsd.mockResolvedValue(100);

        await Offer.create({ network: net, provider, lid: 1, marketAddress });
        await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'accepted' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        const offer = await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress, accepted: true });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'accepted' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(offer.id);
          });
      });

      it('should return 200 and correct data when [status=cancelled] is set', async () => {
        mockTryToUsd.mockResolvedValue(100);

        await Offer.create({ network: net, provider, lid: 1, marketAddress });
        await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'cancelled' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        const offer = await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress, cancelled: true });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'cancelled' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(offer.id);
          });
      });

      it('should return 200 and correct data when [status=executed] is set', async () => {
        mockTryToUsd.mockResolvedValue(100);

        await Offer.create({ network: net, provider, lid: 1, marketAddress });
        await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'executed' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        const offer = await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress, executed: true });
        await request(app.getHttpServer())
          .get(`/v1/offers`)
          .query({ net, status: 'executed' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(offer.id);
          });
      });
    });

    it('should return 200 and correct data when [fromDate,toDate] are set', async () => {
      mockTryToUsd.mockResolvedValue(100);

      const now = moment();
      const offer = await Offer.create({
        network: net,
        provider,
        lid: 1,
        marketAddress,
        createdAt: now.clone().subtract('1', 'minutes').toISOString(),
      });
      const offer2 = await Offer.create({
        network: net,
        provider: provider2,
        lid: 2,
        marketAddress,
        createdAt: now.clone().subtract('2', 'minutes').toISOString(),
      });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, fromDate: 'invalid iso string' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a valid ISO8601 date',
            param: 'fromDate',
            type: 'invalid_request_error',
          },
        });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, toDate: 'invalid iso string' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a valid ISO8601 date',
            param: 'toDate',
            type: 'invalid_request_error',
          },
        });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, fromDate: now.subtract(1, 'minute').toISOString() })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, toDate: now.subtract(1, 'minute').toISOString() })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(offer2.id);
        });
    });

    it('should return 200 and correct count when [query=count] is set', async () => {
      mockTryToUsd.mockResolvedValue(100);
      await Offer.create({ network: net, provider, lid: 1, marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
      const offer = await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress });
      await request(app.getHttpServer())
        .get(`/v1/offers`)
        .query({ net, provider: offer.provider, lid: offer.lid, count: true })
        .expect(200)
        .expect({ data: { count: '1' } });
    });

    it('should return 200 and correct data when [query=limit] is set', async () => {
      await Offer.create({ network: net, provider, lid: 1, marketAddress });
      await Offer.create({ network: net, provider: provider2, lid: 2, marketAddress });
      await Offer.create({ network: net, provider: provider3, lid: 3, marketAddress });
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
      await Offer.create({ network: net, lid: 2, marketAddress, updatedAt: now.toISOString() });
      const offer = await Offer.create({
        network: net,
        provider: provider,
        lid: 1,
        marketAddress,
        updatedAt: now.add(1, 's').toISOString(),
      });
      const offer2 = await Offer.create({
        network: net,
        provider: provider3,
        marketAddress,
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

  describe('.countUnread', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/count-unread`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/offers/count-unread`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    describe('when authenticated user has offers where it is a provider', () => {
      it('should return 200 and correct result', async () => {
        await Offer.create({ network: net, provider: address, lid: 1 });
        await Offer.create({ network: net, provider: address, lid: 2, readProvider: true });
        await request(app.getHttpServer())
          .get(`/v1/offers/count-unread`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              asProvider: 1,
              asOfferer: 0,
            },
          });
      });

      it('should return 200 and correct result', async () => {
        await Offer.create({ network: net, provider: address, lid: 1 });
        await Offer.create({ network: net, provider: address, lid: 2 });
        await request(app.getHttpServer())
          .get(`/v1/offers/count-unread`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              asProvider: 2,
              asOfferer: 0,
            },
          });
      });

      it('should return 200 and correct result', async () => {
        await Offer.create({ network: net, provider: address, lid: 1, readProvider: true });
        await Offer.create({ network: net, provider: address, lid: 2, readProvider: true });
        await request(app.getHttpServer())
          .get(`/v1/offers/count-unread`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              asProvider: 0,
              asOfferer: 0,
            },
          });
      });

      describe('target a specific liquidity', () => {
        it('should return 200 and correct result', async () => {
          await Offer.create({
            network: net,
            provider: address,
            marketAddress,
            lid: 1,
          });
          await Offer.create({
            network: net,
            provider: address,
            marketAddress: '0xMarket2',
            lid: 1,
          });
          await Offer.create({ network: net, provider: address, lid: 2, readProvider: true });
          await request(app.getHttpServer())
            .get(`/v1/offers/count-unread`)
            .query({ net, provider: address, lid: 1, marketAddress })
            .set('Authorization', 'bearer ' + token)
            .expect(200)
            .expect({
              data: {
                asProvider: 1,
                asOfferer: 0,
              },
            });
        });
      });
    });

    describe('when authenticated user has offers where it is an offerer', () => {
      it('should return 200 and correct result', async () => {
        await Offer.create({ network: net, creator: address, lid: 1 });
        await Offer.create({ network: net, creator: address, lid: 2, readOfferer: true });
        await request(app.getHttpServer())
          .get(`/v1/offers/count-unread`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              asProvider: 0,
              asOfferer: 1,
            },
          });
      });

      describe('target a liquidity', () => {
        it('should return 200 and correct result', async () => {
          await Offer.create({ network: net, creator: address, lid: 1, provider: address2, marketAddress });
          await Offer.create({ network: net, creator: address, lid: 2, readOfferer: true });
          await request(app.getHttpServer())
            .get(`/v1/offers/count-unread`)
            .query({ net, marketAddress, provider: address2, lid: 1 })
            .set('Authorization', 'bearer ' + token)
            .expect(200)
            .expect({
              data: {
                asProvider: 0,
                asOfferer: 1,
              },
            });
        });
      });
    });
  });

  describe('.markAsRead', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/offers/mark-read`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .put(`/v1/offers/mark-read`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    describe('when auth user has offers where is the liquidity provider', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, provider: address, lid: 1 });
        let offer2 = await Offer.create({ network: net, provider: address, lid: 2, readProvider: true });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeTruthy();
        expect(offer.readOfferer).toBeFalsy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeFalsy();
        expect(offer2.readProvider).toBeTruthy();
      });
    });

    describe('when authenticated user has offers where it is an offerer', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, creator: address, lid: 1 });
        let offer2 = await Offer.create({ network: net, creator: address, lid: 2, readOfferer: true });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeFalsy();
        expect(offer.readOfferer).toBeTruthy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeTruthy();
        expect(offer2.readProvider).toBeFalsy();
      });
    });

    describe('query by provider', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, provider: address, lid: 1, readOfferer: false });
        let offer2 = await Offer.create({ network: net, creator: address, lid: 2, readOfferer: false });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net, provider: address })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeTruthy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeFalsy();
      });
    });

    describe('query by marketAddress', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, provider: address, marketAddress, lid: 1, readOfferer: false });
        let offer2 = await Offer.create({ network: net, creator: address, lid: 2, readOfferer: false });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net, marketAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeTruthy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeFalsy();
      });
    });

    describe('query by offerId', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, provider: address, offerId: 1, lid: 1, readOfferer: false });
        let offer2 = await Offer.create({ network: net, creator: address, lid: 2, readOfferer: false });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net, offerId: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeTruthy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeFalsy();
      });
    });

    describe('query by net, provider, lid', () => {
      it('should return 200 and correct result', async () => {
        let offer = await Offer.create({ network: net, provider: address, offerId: 1, lid: 1, readOfferer: false });
        let offer2 = await Offer.create({ network: net, creator: address, lid: 2, readOfferer: false });
        await request(app.getHttpServer())
          .put(`/v1/offers/mark-read`)
          .query({ net, provider, lid: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              success: true,
            },
          });

        offer = await Offer.getById(offer.id);
        expect(offer.readProvider).toBeTruthy();

        offer2 = await Offer.getById(offer2.id);
        expect(offer2.readOfferer).toBeFalsy();
      });
    });
  });
});

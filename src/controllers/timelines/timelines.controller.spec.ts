import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { TimelinesController } from './timelines.controller';
import Event from '../../models/event';
import * as moment from 'moment';

describe('TimelinesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';

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
      controllers: [TimelinesController],
      providers: [],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.get', function () {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
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
        .get(`/v1/timelines`)
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

    it('should return 200 and correct events', async () => {
      const e1 = await Event.create({ network: net, createdAt: moment().subtract(2, 's').toISOString() });
      const e2 = await Event.create({ network: net, createdAt: moment().toISOString() });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(e2.id);
          expect(res.body.data[1].id).toEqual(e1.id);
        });
    });

    it('should return 200 and correct events when limit is set', async () => {
      await Event.create({ network: net, createdAt: moment().subtract(2, 's').toISOString() });
      const e2 = await Event.create({ network: net, createdAt: moment().toISOString() });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, limit: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(e2.id);
        });
    });

    it('should return 200 and correct events when limit and lastSerial are set', async () => {
      const e1 = await Event.create({ network: net, createdAt: moment().subtract(2, 's').toISOString() });
      await Event.create({ network: net, createdAt: moment().toISOString() });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, limit: 1, lastSerial: 2 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(e1.id);
        });
    });

    it('should return 200 and correct events when "markets" field was provided', async () => {
      await Event.create({ network: net, marketAddress: '0xMarket' });
      const e2 = await Event.create({ network: net, marketAddress: '0xMarket2' });
      const e3 = await Event.create({ network: net, marketAddress: '0xMarket3' });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, markets: `["0xMarket2", "0xMarket3"]` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(e3.id);
          expect(res.body.data[1].id).toEqual(e2.id);
        });
    });

    it('should return 200 and correct events when "wallets" field was provided', async () => {
      await Event.create({ network: net, marketAddress: '0xMarket' });
      const e2 = await Event.create({ network: net, provider: '0xProvider' });
      const e3 = await Event.create({ network: net, creator: '0xProvider2' });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, wallets: `["0xProvider", "0xProvider2"]` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(e3.id);
          expect(res.body.data[1].id).toEqual(e2.id);
        });
    });

    it('should return 200 and correct events when "wallets" and "markets" fields were provided', async () => {
      await Event.create({ network: net, marketAddress: '0xMarket' });
      const e2 = await Event.create({ network: net, provider: '0xProvider' });
      const e3 = await Event.create({ network: net, creator: '0xProvider2' });
      const e4 = await Event.create({ network: net, marketAddress: '0xMarket3' });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, wallets: `["0xProvider", "0xProvider2"]`, markets: `["0xMarket3"]` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(3);
          expect(res.body.data[0].id).toEqual(e4.id);
          expect(res.body.data[1].id).toEqual(e3.id);
          expect(res.body.data[2].id).toEqual(e2.id);
        });
    });

    it('should return 200 and correct events when "liquidities" field was provided', async () => {
      await Event.create({ network: net, marketAddress: '0xMarket' });
      const e2 = await Event.create({ network: net, provider: '0xProvider', lid: 0 });
      const e3 = await Event.create({ network: net, provider: '0xProvider', lid: 1 });
      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, liquidities: `[{"provider": "0xProvider", "lid": 1}]` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(e3.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/timelines`)
        .query({ net, liquidities: `[{"provider": "0xProvider", "lid": 0}]` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(e2.id);
        });
    });
  });
});

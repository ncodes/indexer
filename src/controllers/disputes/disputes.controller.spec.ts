import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import NetworkService from '../../network/network.service';
import { makeSession } from '../auth/utils';
import { MarketsService } from '../markets/markets.service';
import { DisputesController } from './disputes.controller';
import Dispute from '../../models/dispute';
import { randStr } from '../../common/common';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

describe('DisputesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};

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
    mockCfgGet.mockReset();
    mockGetMarketCore.mockReset();

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [DisputesController],
      providers: [ConfigService, NetworkService, MarketsService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();
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
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.list', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/disputes`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'network',
            type: 'invalid_request_error',
          },
        });
    });

    describe('query: count=true', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, count: true })
          .send({})
          .expect(200)
          .expect({ data: { count: '1' } });
      });
    });

    describe('query: marketId is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({
          network: net,
          marketId: '0xMarket',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, marketId: market.marketId })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: creator is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({
          network: net,
          creator: '0xCreator',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, creator: market.creator })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: defendant is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({
          network: net,
          defendant: '0xDefendant',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, defendant: market.defendant })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: orderId is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, orderId: 1 });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, orderId: market.orderId })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: disputeId is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, disputeId: 1 });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, disputeId: market.disputeId })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: appeal is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, appeal: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, appeal: market.appeal })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: executed is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, executed: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, executed: market.executed })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: released is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, released: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, released: market.released })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: abandoned is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({ network: net, abandoned: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, abandoned: market.abandoned })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('query: orderReleased is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const market = await Dispute.create({
          network: net,
          orderReleased: true,
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, orderReleased: market.orderReleased })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });
  });
});

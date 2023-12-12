import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import User from '../../models/user';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import { makeSession } from '../auth/utils';
import { MarketService } from '../markets/market.service';
import { DisputesController } from './disputes.controller';

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
      providers: [ConfigService, NetworkService, MarketService, MetadataService, RedisService, ExchangeRateService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .overrideProvider(ExchangeRateService)
      .useValue(new (jest.fn())())
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
            param: 'net',
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

    describe('query: marketAddress is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          marketAddress: '0xMarket',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, marketAddress: dispute.marketAddress })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('query: creator is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          creator: '0xCreator',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, creator: dispute.creator })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('query: defendant is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          defendant: '0xDefendant',
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, defendant: dispute.defendant })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('query: orderId is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, orderId: 1 });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, orderId: dispute.orderId })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('query: disputeId is set', () => {
      it('should return correctly', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, disputeId: 1 });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, disputeId: dispute.disputeId })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('redispute is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, redispute: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'redispute' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('executed is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, executed: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'executed' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('stalled is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, executed: true, released: null });
        await Dispute.create({ network: net, executed: true, released: false });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'stalled' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('released is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, released: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'released' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('cancelled is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, executed: true, released: false });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'cancelled' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('abandoned is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({ network: net, executed: true, abandoned: true });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'abandoned' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('orderReleased is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          orderReleased: true,
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'orderReleased' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('draft is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          numMediators: 2,
          numMediatorsDrafted: 1,
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'draft' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('undraft is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          executed: true,
          numMediatorsDrafted: 2,
          numMediatorsUndrafted: 1,
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'undraft' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });

      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const dispute = await Dispute.create({
          network: net,
          orderReleased: true,
          numMediatorsDrafted: 2,
          numMediatorsUndrafted: 1,
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'undraft' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('evidence is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const now = moment();
        const dispute = await Dispute.create({
          network: net,
          numMediators: 2,
          numMediatorsDrafted: 2,
          evidenceEndAt: now.clone().add('5', 's').toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'evidence' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('commit is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const now = moment();
        const dispute = await Dispute.create({
          network: net,
          numMediators: 2,
          numMediatorsDrafted: 2,
          evidenceEndAt: now.clone().subtract('1', 's').toISOString(),
          commitEndAt: now.clone().add('2', 's').toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'commit' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('reveal is set', () => {
      it('should return correct result', async () => {
        await Dispute.create({ network: net });
        const now = moment();
        const dispute = await Dispute.create({
          network: net,
          numMediators: 2,
          numMediatorsDrafted: 2,
          evidenceEndAt: now.clone().subtract('2', 's').toISOString(),
          commitEndAt: now.clone().subtract('1', 's').toISOString(),
          revealEndAt: now.clone().add('2', 's').toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, status: 'reveal' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('query: fromDate and toDate were set', () => {
      it('should return correct result', async () => {
        const now = moment();
        const dispute = await Dispute.create({ network: net, createdAt: now.clone().subtract('6', 's').toISOString() });
        const dispute2 = await Dispute.create({
          network: net,
          createdAt: now.clone().subtract('4', 's').toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, fromDate: now.clone().subtract(4, 's').toISOString() })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, fromDate: now.clone().subtract(6, 's').toISOString() })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });

        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({
            net,
            fromDate: now.clone().subtract(6, 's').toISOString(),
            toDate: now.clone().subtract(5, 's').toISOString(),
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });

    describe('participant is set', () => {
      it('should return correct result when participant is creator', async () => {
        await Dispute.create({ network: net, creator: '0xCreator' });
        const dispute = await Dispute.create({ creator: '0xCreator2', network: net });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, participant: '0xCreator2' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });

      it('should return correct result when participant is a defendant', async () => {
        await Dispute.create({ network: net, defendant: '0xCreator' });
        const dispute = await Dispute.create({ defendant: '0xCreator2', network: net });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, participant: '0xCreator2' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });

      it('should return correct result when participant is a draftee', async () => {
        await Dispute.create({ network: net, defendant: '0xCreator', orderId: 0, disputeId: 0 });
        const dispute = await Dispute.create({ defendant: '0xCreator2', network: net, orderId: 1, disputeId: 0 });
        await Draft.create({ network: net, orderId: 1, disputeIndex: 0, owner: '0xDraftee' });
        await request(app.getHttpServer())
          .get(`/v1/disputes`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, participant: '0xDraftee' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(dispute.id);
          });
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { makeSession } from '../auth/utils';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';
import { MarketService } from '../markets/market.service';
import Liquidity from '../../models/liquidity';
import { ConfigService } from '../../config/config.service';
import { randStr } from '../../common/common';
import Meta, { MetaKeys } from '../../models/meta';
import * as moment from 'moment';
import BadgeGrant from '../../models/badge_grant';
import LiquidityEvent from '../../models/liquidity_event';
import Offer from '../../models/offers';
import Swap from '../../models/swap';

const mockCfgGet = jest.fn();
const mockGetContractParam = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet, getContractParam: mockGetContractParam };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('LiquidityController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';
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
    mockGetContractParam.mockReset();
    mockGetMarketCore.mockReset();

    cfgObj = { 'auth.jwtSecret': 'secret_secret', 'app.badges.kyc': 'kyc' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [LiquidityController],
      providers: [ConfigService, NetworkService, LiquidityService, MarketService, MetadataService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        maxOpenDispute: '3',
      }),
    );

    await app.init();
  });

  let u: User;
  let token: string;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.get', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0`)
        .query({})
        .set('Authorization', 'bearer ' + token)
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
        .get(`/v1/liquidities/0xMarket/0xProvider/0`)
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

    it('should return 404 when liquidity was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'liquidity not found' },
        });
    });

    it('should return 404 when liquidity was not found', async () => {
      const liq = await Liquidity.create({
        network: net,
        provider: '0xProvider',
        marketAddress: '0xMarket',
        lid: 0,
      });

      const mockExtendLiquidity = jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(liq.id);
          expect(mockExtendLiquidity).toHaveBeenCalled();
        });
    });
  });

  describe('.events', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
        .query({})
        .set('Authorization', 'bearer ' + token)
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
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
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

    it('should return 200 and correct result', async () => {
      const offer = await Offer.create({ network: net, offerId: 1 });
      const swap = await Swap.create({ network: net, orderId: 1 });
      const event = await LiquidityEvent.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().subtract(1, 'day').toISOString(),
      });
      const event2 = await LiquidityEvent.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        offerId: 1,
        orderId: 1,
        createdAt: moment().toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(event2.id);
          expect(res.body.data[1].id).toEqual(event.id);
          expect(res.body.data[0].offer).toBeDefined();
          expect(res.body.data[0].offer.id).toEqual(offer.id);
          expect(res.body.data[0].swap).toBeDefined();
          expect(res.body.data[0].swap.id).toEqual(swap.id);
        });
    });

    it('should return 200 and correct result when limit and offset are used', async () => {
      const event = await LiquidityEvent.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().subtract(1, 'day').toISOString(),
      });
      const event2 = await LiquidityEvent.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
        .query({ net, limit: 1 })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(event2.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
        .query({ net, limit: 1, offset: 1 })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(event.id);
        });
    });
  });

  describe('.list', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities`)
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

    describe('provider is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress: '0x123',
          amount: '10',
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress: '0x123',
          amount: '10',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, provider: '0xProvider' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });

      it('should return 200 and the correct liquidity records when no' + ' provider was set', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x123',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('market is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x124',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: '0x123' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('maxOpenDispute = 3', () => {
      it('should return 200 and the correct liquidity records', async () => {
        mockGetContractParam.mockImplementation(() => {
          return '3';
        });

        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress: '0x123',
          amount: '10',
          openDisputes: 2,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress: '0x124',
          amount: '10',
          openDisputes: 3,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, address: '0x123' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('filter by amount', () => {
      it('should return 200 and the correct liquidity records', async () => {
        mockGetContractParam.mockImplementation(() => {
          return '3';
        });

        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress: '0x123',
          amount: '1',
          minSwap: '3',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress: '0x124',
          amount: '1',
          minSwap: '2',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amount: '2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amount: '<2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amount: '>2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(res.body.data[1].id).toEqual(liq2.id);
          });
      });
    });

    describe('filter by price', () => {
      it('should return 200 and the correct liquidity records', async () => {
        mockGetContractParam.mockImplementation(() => {
          return '3';
        });

        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress: '0x123',
          amount: '1',
          price: '3',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress: '0x124',
          amount: '1',
          price: '2',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, price: '2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, price: '<2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, price: '>2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(res.body.data[1].id).toEqual(liq2.id);
          });
      });
    });

    describe('limit is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x124',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('offset is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x124',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('count is set', () => {
      it('should return 200 and count', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
        });
        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, provider: '0xProvider', count: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.count).toEqual('1');
          });
      });
    });

    describe('kycLp is set', () => {
      it('should return 200', async () => {
        await BadgeGrant.create({ grantee: '0xProvider', badge: 'kyc', network: net });
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, kycLp: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('kycTaker is set', () => {
      it('should return 200 ', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
          requiredSwapBadges: ['kyc'],
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x123',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, kycTaker: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });

    describe('swapBadges is set', () => {
      it('should return 200 ', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress: '0x123',
          requiredSwapBadges: ['kyc'],
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0x123',
          requiredSwapBadges: ['kyc/usa'],
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, swapBadges: ['kyc'] })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, swapBadges: ['kyc/'] })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(res.body.data[1].id).toEqual(liq2.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
          });
      });
    });
  });
});

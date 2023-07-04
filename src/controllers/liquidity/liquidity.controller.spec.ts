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

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
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

    describe('market ID is set', () => {
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
          .query({ net, marketAddress: '0x123' })
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
          .query({ net, marketAddress: '0x123' })
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

        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress: '0x123',
          amount: '10',
          minSwap: '3',
          maxSwap: '5',
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress: '0x124',
          amount: '10',
          minSwap: '2',
          maxSwap: '6',
        });

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amount: '1' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

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
          .query({ net, amount: '3' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amount: '6' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
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
        });
        const liq = await Liquidity.create({
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
  });
});

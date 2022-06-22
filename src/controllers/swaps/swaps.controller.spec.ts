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
import { MetadataService } from '../../services/metadata.service';
import { makeSession } from '../auth/utils';
import * as cryptoRandomString from 'crypto-random-string';
import { MarketsService } from '../markets/markets.service';
import { SwapsController } from './swaps.controller';
import { LiquidityService } from '../liquidity/liquidity.service';
import Swap from '../../models/swap';
import Market from '../../models/market';
import mock = jest.mock;
import Liquidity from '../../models/liquidity';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('SwapsController', () => {
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
      controllers: [SwapsController],
      providers: [ConfigService, NetworkService, MarketsService, LiquidityService],
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
  const net = 'ethereumMainnet';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.get', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'unknown network' },
        });
    });

    it('should return 404 when swap order was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'swap not found' },
        });
    });

    it('should return 404 when swap order was not found', async () => {
      await Swap.create({ network: net, orderId: 1, marketId: '0xMarket' });
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should return 404 when liquidity was not found', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketId: market.marketId,
      });
      jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'liquidity not found' },
        });
    });

    it('should return 404 when liquidity was not found', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketId: market.marketId,
      });
      jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'liquidity not found' },
        });
    });

    it('should return 200 with correct result', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
      });
      await Liquidity.create({
        network: net,
        marketId: market.marketId,
        provider: '0xProvider',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketId: market.marketId,
        provider: '0xProvider',
      });
      jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
      jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidity).toBeDefined();
          expect(res.body.data.market).toBeDefined();
        });
    });
  });

  describe('.list', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'unknown network' },
        });
    });

    describe('with address set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider2',
        });
        const swap = await Swap.create({
          network: net,
          orderId: 1,
          marketId: market.marketId,
          provider: '0xProvider',
        });

        const swap2 = await Swap.create({
          network: net,
          orderId: 1,
          marketId: market.marketId,
          taker: '0xProvider',
          provider: '0xProvider2',
        });

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.marketId, address: '0xProvider' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(swap2.id);
            expect(res.body.data[1].id).toEqual(swap.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.marketId, address: '0xProvider2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap2.id);
          });
      });
    });

    describe('with limit set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider2',
        });
        await Swap.create({
          network: net,
          orderId: 1,
          marketId: market.marketId,
          provider: '0xProvider',
        });
        const swap2 = await Swap.create({
          network: net,
          orderId: 2,
          marketId: market.marketId,
          provider: '0xProvider',
        });

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.marketId, address: '0xProvider', limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap2.id);
            expect(res.body.meta.queryCount).toEqual('2');
          });
      });
    });

    describe('with limit and offset set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider2',
        });
        const swap = await Swap.create({
          network: net,
          orderId: 1,
          marketId: market.marketId,
          provider: '0xProvider',
        });
        await Swap.create({
          network: net,
          orderId: 2,
          marketId: market.marketId,
          provider: '0xProvider',
        });

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({
            net,
            mid: market.marketId,
            address: '0xProvider',
            offset: 1,
            limit: 1,
          })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap.id);
            expect(res.body.meta.queryCount).toEqual('2');
          });
      });
    });
  });
});

import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { ConfigService } from '../../config/config.service';
import { DBService } from '../../db/db.service';
import BadgeGrant from '../../models/badge_grant';
import Event, { Events } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import Meta, { MetaKeys } from '../../models/meta';
import Offer from '../../models/offer';
import Swap from '../../models/swap';
import User from '../../models/user';
import { powOf } from '../../network/common';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis/redis.service';
import { makeSession } from '../auth/utils';
import { MarketService } from '../markets/market.service';
import SwapService from '../swaps/swap.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';

const mockCfgGet = jest.fn();
const mockGetContractParam = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet, getContractParam: mockGetContractParam };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

describe('LiquidityController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';
  let marketAddress = '';
  const marketAddress2 = '0xMarket2';
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

    marketAddress = '0xMarket';

    cfgObj = { 'auth.jwtSecret': 'secret_secret', 'app.badges.kyc': 'kyc' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [LiquidityController],
      providers: [
        ConfigService,
        NetworkService,
        LiquidityService,
        MarketService,
        MetadataService,
        RedisService,
        ExchangeRateService,
        SwapService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
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

    it('should return 200 when liquidity was found', async () => {
      const liq = await Liquidity.create({
        network: net,
        provider: '0xProvider',
        marketAddress: '0xMarket',
        lid: 0,
      });

      const mockExtendLiquidity = jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);
      const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(liq.id);
          expect(mockExtendLiquidity).toHaveBeenCalled();
          expect(mockExtendMarket).toHaveBeenCalled();
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
      const event = await Event.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().subtract(1, 'day').toISOString(),
        action: Events.LiquidityAdd,
      });
      const event2 = await Event.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        offerId: 1,
        orderId: 1,
        swapId: swap.id,
        createdAt: moment().toISOString(),
        action: Events.LiquidityAdd,
      });

      const mockExtendSwap = jest
        .spyOn(app.get(SwapService), 'extendSwap')
        .mockImplementation(async (swap: Swap, _select: string[]) => {
          swap.cost = 100;
          return null;
        });

      await request(app.getHttpServer())
        .get(`/v1/liquidities/0xMarket/0xProvider/0/events`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(mockExtendSwap).toHaveBeenCalled();
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(event2.id);
          expect(res.body.data[1].id).toEqual(event.id);
          expect(res.body.data[0].offer).toBeDefined();
          expect(res.body.data[0].offer.id).toEqual(offer.id);
          expect(res.body.data[0].swap).toBeDefined();
          expect(res.body.data[0].swap.id).toEqual(swap.id);
          expect(res.body.data[0].swap.cost).toEqual(100);
        });
    });

    it('should return 200 and correct result when limit and offset are used', async () => {
      const event = await Event.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().subtract(1, 'day').toISOString(),
        action: Events.LiquidityAdd,
      });
      const event2 = await Event.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        createdAt: moment().toISOString(),
        action: Events.LiquidityAdd,
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
    beforeEach(async () => {
      await Market.create({
        address: marketAddress,
        network: net,
        baseDecimals: 18,
        quoteDecimals: 18,
      });
      await Market.create({
        address: marketAddress2,
        network: net,
        baseDecimals: 18,
        quoteDecimals: 18,
      });
    });

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

    describe('market matches IDO market', () => {
      it('should return 200 and only IDO liquidity', async () => {
        await Market.updateByNetworkAddress(net, marketAddress, {
          address: '0xEEA2f6BEed812f17a3A0dB2B93c7e8EdA44cA97E',
        });

        marketAddress = '0xEEA2f6BEed812f17a3A0dB2B93c7e8EdA44cA97E';

        const liq = await Liquidity.create({
          network: net,
          provider: '0xAEA70653A241c7a02BB3624935c51f052390A077',
          marketAddress,
          amount: '10',
        });

        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: '10',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('provider is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: '10',
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: '10',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, provider: '0xProvider' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });

      it('should return 200 and the correct liquidity records when no provider was set', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('market is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0xMarket2',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('paused is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          paused: false,
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
          paused: true,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, paused: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, paused: false })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });
      });
    });

    describe('liquidity is reached max open order', () => {
      it('should return 200 and not include the liquidity', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          openOrders: 3,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0xMarket2',
        });

        mockGetContractParam.mockResolvedValue(3);

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });
      });

      it('should return 200 and all liquidity if isProvider query param = true along with provider address', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          openOrders: 3,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
        });

        mockGetContractParam.mockResolvedValue(3);

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress, provider: '0xProvider', isProvider: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });
      });
    });

    describe('liquidity is reached max open dispute', () => {
      it('should return 200 and not include the liquidity', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          openDisputes: 3,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress: '0xMarket2',
        });

        mockGetContractParam.mockResolvedValue(3);

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });
      });

      it('should return 200 and all liquidity if isProvider query param = true along with provider address', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          openDisputes: 3,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
        });

        mockGetContractParam.mockResolvedValue(3);

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress, provider: '0xProvider', isProvider: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });
      });
    });

    describe('base or quote is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        const liq = await Liquidity.create({
          network: net,
          marketAddress,
          provider: '0xProvider',
          amount: '10',
          base: 'BASE',
          quote: 'QUOTE',
          baseAddress: '0xBaseAddress',
          quoteAddress: '0xQuoteAddress',
        });

        const liq2 = await Liquidity.create({
          network: net,
          marketAddress,
          provider: '0xProvider2',
          amount: '10',
          base: 'BASE2',
          quote: 'QUOTE2',
          baseAddress: '0xBaseAddress2',
          quoteAddress: '0xQuoteAddress2',
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);

        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, base: '0xBaseAddress' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, quote: '0xQuoteAddress' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, base: 'BAsE2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, quote: 'QUOTe2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq2.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('amountUsd is set', () => {
      it(`should return 400 when 'amountUsd' is set but 'market' was not set`, async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: powOf(10, 18).toString(),
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: powOf(20, 18).toString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, amountUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: "'amountUsd' and 'priceUsd' filters require 'market' to be set",
            },
          });
      });

      it(`should return 404 when 'amountUsd' is set and 'market' is set but market does not exist`, async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: powOf(10, 18).toString(),
        });

        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: powOf(20, 18).toString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: '0xMarket3', amountUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(404)
          .expect({
            error: { message: 'market not found' },
          });
      });

      it(`should return 200 when 'amountUsd' is set and 'market' is set and it exists`, async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: powOf(10, 18).toString(),
          createdAt: moment().subtract(1, 'day').toISOString(),
        });

        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: powOf(20, 18).toString(),
          createdAt: moment().toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        mockTryToUsd.mockResolvedValue('0.5');

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress, amountUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(liq2.id);
            expect(res.body.data[0].amountUsd).toEqual(10);
            expect(res.body.data[1].id).toEqual(liq.id);
            expect(res.body.data[1].amountUsd).toEqual(5);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('priceUsd is set', () => {
      it(`should return 400 when 'priceUsd' is set but 'market' was not set`, async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: powOf(10, 18).toString(),
        });

        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: powOf(20, 18).toString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, priceUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: "'amountUsd' and 'priceUsd' filters require 'market' to be set",
            },
          });
      });

      it(`should return 404 when 'priceUsd' is set and 'market' is set but market does not exist`, async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          price: powOf(10, 18).toString(),
        });

        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          price: powOf(20, 18).toString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: '0xMarket3', priceUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(404)
          .expect({
            error: { message: 'market not found' },
          });
      });

      it(`should return 200 when 'priceUsd' is set and 'market' is set and it exists`, async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          marketAddress,
          amount: '1',
          price: powOf(10, 18).toString(),
        });

        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: '1',
          price: powOf(20, 18).toString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        mockTryToUsd.mockResolvedValue('0.5');

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, market: marketAddress, priceUsd: '>1' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(liq2.id);
            expect(res.body.data[0].priceUsd).toEqual(10);
            expect(res.body.data[1].id).toEqual(liq.id);
            expect(res.body.data[1].priceUsd).toEqual(5);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
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
          marketAddress,
          amount: '10',
          openDisputes: 2,
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: '10',
          openDisputes: 3,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, address: '0x123' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
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
          marketAddress,
          amount: '1',
          minSwap: '3',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: '1',
          minSwap: '2',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);
        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

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
          marketAddress,
          amount: '1',
          price: '3',
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          marketAddress,
          amount: '1',
          price: '2',
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(undefined);
        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

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
          marketAddress,
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('offset is set', () => {
      it('should return 200 and the correct liquidity records', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('count is set', () => {
      it('should return 200 and count', async () => {
        await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
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
          marketAddress,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, kycLp: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('kycTaker is set', () => {
      it('should return 200 ', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          requiredSwapBadges: ['kyc'],
        });
        await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, kycTaker: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });

    describe('swapBadges is set', () => {
      it('should return 200 ', async () => {
        const liq = await Liquidity.create({
          network: net,
          provider: '0xProvider',
          amount: '10',
          marketAddress,
          requiredSwapBadges: ['kyc'],
          updatedAt: moment().subtract(1, 'day').toISOString(),
        });
        const liq2 = await Liquidity.create({
          network: net,
          provider: '0xProvider2',
          amount: '10',
          marketAddress,
          requiredSwapBadges: ['kyc/usa'],
          updatedAt: moment().subtract(2, 'day').toISOString(),
        });

        const mockExtendLiquidity = jest
          .spyOn(app.get(LiquidityService), 'extendLiquidity')
          .mockResolvedValue(undefined);
        const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .get(`/v1/liquidities`)
          .query({ net, swapBadges: ['kyc'] })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(liq.id);
            expect(mockExtendLiquidity).toHaveBeenCalled();
            expect(mockExtendMarket).toHaveBeenCalled();
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
            expect(mockExtendMarket).toHaveBeenCalled();
          });
      });
    });
  });

  describe('.fill', function () {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0x123/100/fill`)
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

    it('should return 404 when market was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0x123/100/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should return 500 when market is not instant', async () => {
      await Market.create({
        network: net,
        address: marketAddress,
        baseType: AssetType.ERC20,
        quoteType: AssetType.SYNTH,
      });

      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/100/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(500)
        .expect((res) => {
          expect(res.body).toEqual({ error: { type: 'api_error', message: 'not implemented' } });
        });
    });

    it('should return 200 when market is instant', async () => {
      await Market.create({
        network: net,
        address: marketAddress,
        baseType: AssetType.ERC20,
        quoteType: AssetType.NATIVE,
        baseDecimals: 18,
        quoteDecimals: 18,
      });

      const liq0 = await Liquidity.create({
        marketAddress,
        lid: 0,
        provider: '0xProvider',
        amount: powOf(50, 18).toString(),
        price: powOf(2, 18).toString(),
      });

      const liq1 = await Liquidity.create({
        marketAddress,
        lid: 1,
        provider: '0xProvider',
        amount: powOf(50, 18).toString(),
        price: powOf(1, 18).toString(),
      });

      const liq2 = await Liquidity.create({
        marketAddress,
        lid: 2,
        provider: '0xProvider',
        amount: powOf(50, 18).toString(),
        price: powOf(3, 18).toString(),
      });

      let cost = powOf(100, 18).toString();
      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/${cost}/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidities).toHaveLength(2);
          expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
          expect(res.body.data.liquidities[0].costFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
          expect(res.body.data.liquidities[1].costFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(25, 18).toString());
          expect(res.body.data.totalFilled).toEqual(cost);
          expect(res.body.data.filled).toBeTruthy();
          expect(res.body.data.cost).toEqual(cost);
        });

      cost = powOf(110, 18).toString();
      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/${cost}/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidities).toHaveLength(2);
          expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
          expect(res.body.data.liquidities[0].costFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
          expect(res.body.data.liquidities[1].costFilled).toEqual(powOf(60, 18).toString());
          expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(30, 18).toString());
          expect(res.body.data.totalFilled).toEqual(cost);
          expect(res.body.data.filled).toBeTruthy();
          expect(res.body.data.cost).toEqual(cost);
        });

      cost = powOf(160, 18).toString();
      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/${cost}/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidities).toHaveLength(3);
          expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
          expect(res.body.data.liquidities[0].costFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
          expect(res.body.data.liquidities[1].costFilled).toEqual(powOf(100, 18).toString());
          expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(50, 18).toString());
          expect(res.body.data.liquidities[2].id).toEqual(liq2.id);
          expect(res.body.data.liquidities[2].costFilled).toEqual(powOf(10, 18).toString());
          expect(res.body.data.liquidities[2].amountFilled).toEqual('3333333333333333333.3');
          expect(res.body.data.totalFilled).toEqual(cost);
          expect(res.body.data.filled).toBeTruthy();
          expect(res.body.data.cost).toEqual(cost);
        });

      cost = powOf(300, 18).toString();
      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/${cost}/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidities).toHaveLength(3);
          expect(res.body.data.totalFilled).toEqual(cost);
          expect(res.body.data.filled).toBeTruthy();
          expect(res.body.data.cost).toEqual(cost);
        });

      cost = powOf(301, 18).toString();
      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/${cost}/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidities).toHaveLength(3);
          expect(res.body.data.totalFilled).toEqual(powOf(300, 18).toString());
          expect(res.body.data.filled).toBeFalsy();
          expect(res.body.data.cost).toEqual(cost);
        });
    });
  });
});

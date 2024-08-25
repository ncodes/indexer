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
import { FeeCalculatorService } from '../../services/fee_calculator.service';

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
  const taker = '0xTaker';
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
        FeeCalculatorService,
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

  describe('.fill', function () {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0x123/100/side/fill`)
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

    it('should return 400 when side is invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0x123/100/side/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'must be either base or quote',
            param: 'side',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when market was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/liquidities/0x123/100/quote/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should return 500 when market is not fungible', async () => {
      await Market.create({
        network: net,
        address: marketAddress,
        baseType: AssetType.ERC20,
        quoteType: AssetType.ERC721,
      });

      await request(app.getHttpServer())
        .get(`/v1/liquidities/${marketAddress}/100/quote/fill`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(500)
        .expect((res) => {
          expect(res.body).toEqual({ error: { type: 'api_error', message: 'not implemented' } });
        });
    });

    describe('side = quote', () => {
      it('should return 200 when market is fungible', async () => {
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

        jest.spyOn(app.get(FeeCalculatorService), 'calculateFee').mockResolvedValue({
          protoFee: '0',
          mktCreatorFee: '0',
          feeBp: 0,
          mktFeeBp: 0,
        });

        let amount = powOf(100, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/quote/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(2);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(25, 18).toString());
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.totalQuantityFilled).toEqual(powOf(75, 18).toString());
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('quote');
          });

        amount = powOf(110, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/quote/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(2);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(60, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(30, 18).toString());
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.totalQuantityFilled).toEqual(powOf(80, 18).toString());
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('quote');
          });

        amount = powOf(160, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/quote/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(100, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[2].id).toEqual(liq2.id);
            expect(res.body.data.liquidities[2].amountFilled).toEqual(powOf(10, 18).toString());
            expect(res.body.data.liquidities[2].quantityFilled).toEqual('3333333333333333333.3');
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.totalQuantityFilled).toEqual('103333333333333333330');
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('quote');
          });

        amount = powOf(300, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/quote/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('quote');
          });

        amount = powOf(301, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/quote/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.totalAmountFilled).toEqual(powOf(300, 18).toString());
            expect(res.body.data.filled).toBeFalsy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('quote');
          });
      });
    });

    describe('side = base', () => {
      it('should return 200 when market is fungible', async () => {
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

        jest.spyOn(app.get(FeeCalculatorService), 'calculateFee').mockResolvedValue({
          protoFee: '0',
          mktCreatorFee: '0',
          feeBp: 0,
          mktFeeBp: 0,
        });

        let amount = powOf(100, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/base/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(2);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(100, 18).toString());
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.totalQuantityFilled).toEqual(powOf(150, 18).toString());
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('base');
          });

        amount = powOf(110, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/base/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(100, 18).toString());
            expect(res.body.data.liquidities[2].id).toEqual(liq2.id);
            expect(res.body.data.liquidities[2].amountFilled).toEqual(powOf(10, 18).toString());
            expect(res.body.data.liquidities[2].quantityFilled).toEqual(powOf(30, 18).toString());
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.totalQuantityFilled).toEqual(powOf(180, 18).toString());
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('base');
          });

        amount = powOf(160, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/base/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.liquidities[0].id).toEqual(liq1.id);
            expect(res.body.data.liquidities[0].quantityFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[0].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].id).toEqual(liq0.id);
            expect(res.body.data.liquidities[1].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[1].quantityFilled).toEqual(powOf(100, 18).toString());
            expect(res.body.data.liquidities[2].id).toEqual(liq2.id);
            expect(res.body.data.liquidities[2].amountFilled).toEqual(powOf(50, 18).toString());
            expect(res.body.data.liquidities[2].quantityFilled).toEqual(powOf(150, 18).toString());
            expect(res.body.data.totalAmountFilled).toEqual(powOf(150, 18).toString());
            expect(res.body.data.totalQuantityFilled).toEqual(powOf(300, 18).toString());
            expect(res.body.data.filled).toBeFalsy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('base');
          });

        amount = powOf(150, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/base/fill`)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.totalAmountFilled).toEqual(amount);
            expect(res.body.data.filled).toBeTruthy();
            expect(res.body.data.amount).toEqual(amount);
            expect(res.body.data.side).toEqual('base');
          });

        amount = powOf(151, 18).toString();
        await request(app.getHttpServer())
          .get(`/v1/liquidities/${marketAddress}/${amount}/base/fill`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.liquidities).toHaveLength(3);
            expect(res.body.data.totalAmountFilled).toEqual(powOf(150, 18).toString());
            expect(res.body.data.filled).toBeFalsy();
            expect(res.body.data.amount).toEqual(amount);
          });
      });
    });
  });
});

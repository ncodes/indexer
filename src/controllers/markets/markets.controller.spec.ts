import { Test, TestingModule } from '@nestjs/testing';
import { MarketsController } from './markets.controller';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import NetworkService from '../../network/network.service';
import { MarketService } from './market.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { makeSession } from '../auth/utils';
import Market, { AssetType } from '../../models/market';
import PermittedTrader from '../../models/permitted_trader';
import LiquidityProvider from '../../models/market_provider';
import * as moment from 'moment';
import { randStr } from '../../common/common';
import Swap from '../../models/swap';
import { RedisService } from '../../services/redis.service';
import { powOf } from '../../network/common';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
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

describe('MarketsController', () => {
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

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
      'app.badges.merchant': 'merchant',
      'app.badges.kyc': 'kyc',
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [MarketsController],
      providers: [ConfigService, NetworkService, MarketService, MetadataService, RedisService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(RedisService)
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

  describe('.top', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/top`)
        .set('Authorization', 'bearer ' + token)
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
        .get(`/v1/markets/top`)
        .set('Authorization', 'bearer ' + token)
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

    it('should return 200 and with correct results', async () => {
      await Market.create({ network: net, address: '0x123' });
      await Market.create({ network: net, address: '0xXYZ' });
      await Swap.create({ network: net, marketAddress: '0x123', valueUsd: '10' });
      await Swap.create({ network: net, marketAddress: '0xXYZ', valueUsd: '5' });
      const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/v1/markets/top`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].address).toEqual('0x123');
          expect(res.body.data[0].volume24h).toEqual('10');
          expect(res.body.data[1].address).toEqual('0xXYZ');
          expect(res.body.data[1].volume24h).toEqual('5');
          expect(mockExtendMarket).toBeCalledTimes(2);
        });
    });

    it('should return 200 and with correct results when limit=1', async () => {
      await Market.create({ network: net, address: '0x123' });
      await Market.create({ network: net, address: '0xXYZ' });
      await Swap.create({ network: net, marketAddress: '0x123', valueUsd: '10' });
      await Swap.create({ network: net, marketAddress: '0xXYZ', valueUsd: '5' });
      const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/v1/markets/top`)
        .set('Authorization', 'bearer ' + token)
        .query({ net, limit: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].address).toEqual('0x123');
          expect(res.body.data[0].volume24h).toEqual('10');
          expect(mockExtendMarket).toBeCalledTimes(1);
        });
    });
  });

  describe('.get', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123`)
        .set('Authorization', 'bearer ' + token)
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
        .get(`/v1/markets/0x123`)
        .set('Authorization', 'bearer ' + token)
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

    it('should return 404 when market is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should 200 and market object when market exists', async () => {
      const market = await Market.create({ address: '0x123', network: net });

      const mockExtendMarket = jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/v1/markets/${market.address}`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(market.id);
          expect(res.body.data.address).toEqual(market.address);
          expect(mockExtendMarket).toHaveBeenCalled();
        });
    });
  });

  describe('.list', () => {
    beforeEach(() => {
      mockTryToUsd.mockResolvedValue(0.5);
      jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);
    });

    it('should 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .set('Authorization', 'bearer ' + token)
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

    it('should 200 and empty list when no market was found ', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(0);
        });
    });

    it('should 200 and list of markets when some markets exist', async () => {
      const market = await Market.create({ network: net, address: '0x123' });

      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(market.id);
        });
    });

    describe('filter by creator', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ creator: '0xCreator', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by address', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, address: '0xAddress' });
        await Market.create({ network: net, address: '0xAddress2' });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, address: '0xAddress' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by permSwap', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0xXYZ',
          creator: '0xCreator',
          permSwap: true,
        });
        const market2 = await Market.create({
          network: net,
          address: '0x123',
          creator: '0xCreator',
          permSwap: false,
        });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, permSwap: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, permSwap: false })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });
      });
    });

    describe('filter by permPut', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, permPut: true });
        const market2 = await Market.create({ network: net, permPut: false });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, permPut: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, permPut: false })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });
      });
    });

    describe('filter by instant', () => {
      it('should 200 and correct market', async () => {
        const m1 = await Market.create({
          network: net,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
          instant: true,
          updatedAt: moment().subtract(3, 's').toISOString(),
        });
        const m2 = await Market.create({
          network: net,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
          instant: true,
          updatedAt: moment().subtract(2, 's').toISOString(),
        });
        const m3 = await Market.create({
          network: net,
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          updatedAt: moment().subtract(1, 's').toISOString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, instant: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(m2.id);
            expect(res.body.data[1].id).toEqual(m1.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, instant: false })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(m3.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(3);
          });
      });
    });

    describe('filter by base address', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
          baseAddress: '0xBaseAddr',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ base: '0xBaseAddr', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by quote address', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
          quoteAddress: '0xQuoteAddr',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ quote: '0xQuoteAddr', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (creator address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ query: market.creator, net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (market ID)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ query: market.address, net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (base asset)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          base: 'BTC',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.base })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (base asset address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          baseAddress: '0xBaseAddress',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.baseAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (quote asset)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          quote: 'BTC',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.quote })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (quote asset address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          quoteAddress: '0xQuoteAddress',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.quoteAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (pair symbol)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          pair: 'BTCUSDT',
        });
        await Market.create({});

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTCUSDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC/USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC-USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by price', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, lowestPrice: '10', amountSwapped: '2' });
        const market2 = await Market.create({ network: net, lowestPrice: '11', amountSwapped: '1' });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '<10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '<11', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(market.id);
            expect(res.body.data[1].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '>11', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '>12', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '<9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ price: '$9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              message: "must be a number (optionally preceded by '>' or '<')",
              param: 'price',
              type: 'invalid_request_error',
            },
          });
      });
    });

    describe('filter by priceUsd', () => {
      let market: Market;
      let market2: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          baseAddress: '0xBase',
          quoteAddress: '0xQuote',
          baseDecimals: 18,
          quoteDecimals: 18,
          lowestPrice: powOf(100, 18).toString(),
          amountSwapped: '2',
        });
        market2 = await Market.create({
          network: net,
          baseAddress: '0xBase',
          quoteAddress: '0xQuote',
          baseDecimals: 18,
          quoteDecimals: 18,
          lowestPrice: powOf(200, 18).toString(),
          amountSwapped: '1',
        });
      });

      it('should return 400 when base was not provided', async () => {
        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: "'priceUsd' filter require 'quote' to be set",
            },
          });
      });

      it('should 200 and correct market', async () => {
        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, priceUsd: '50', quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '<50', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '<100', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(market.id);
            expect(res.body.data[1].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '>100', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '>102', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '<49', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '49', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ priceUsd: '$49', net, quote: '0xQuote' })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              message: "must be a number (optionally preceded by '>' or '<')",
              param: 'priceUsd',
              type: 'invalid_request_error',
            },
          });
      });
    });

    describe('filter by liquidity', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, totalLiquidity: '10', amountSwapped: '2' });
        const market2 = await Market.create({ network: net, totalLiquidity: '11', amountSwapped: '1' });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '<10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '<11', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(market.id);
            expect(res.body.data[1].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '>11', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '>12', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '<9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidity: '$9', net })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              message: "must be a number (optionally preceded by '>' or '<')",
              param: 'liquidity',
              type: 'invalid_request_error',
            },
          });
      });
    });

    describe('filter by liquidityUsd', () => {
      let market: Market;
      let market2: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          baseAddress: '0xBase',
          quoteAddress: '0xQuote',
          baseDecimals: 18,
          quoteDecimals: 18,
          totalLiquidity: powOf(100, 18).toString(),
          amountSwapped: '2',
        });
        market2 = await Market.create({
          network: net,
          baseAddress: '0xBase',
          quoteAddress: '0xQuote',
          baseDecimals: 18,
          quoteDecimals: 18,
          totalLiquidity: powOf(200, 18).toString(),
          amountSwapped: '1',
        });
      });

      it('should return 400 when base was not provided', async () => {
        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '10', net })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: "'liquidityUsd' filter require 'base' to be set",
            },
          });
      });

      it('should 200 and correct market', async () => {
        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '50', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '<50', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '<100', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(market.id);
            expect(res.body.data[1].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '>100', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '>101', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '<49', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '49', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(0);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ liquidityUsd: '$49', net, base: '0xBase' })
          .set('Authorization', 'bearer ' + token)
          .expect(400)
          .expect({
            error: {
              message: "must be a number (optionally preceded by '>' or '<')",
              param: 'liquidityUsd',
              type: 'invalid_request_error',
            },
          });
      });
    });

    describe('filter by merchantLp', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, requiredPutBadges: ['merchant'] });
        await Market.create({ network: net });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, merchantLp: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by kycLp', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, requiredPutBadges: ['kyc'] });
        await Market.create({ network: net });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, kycLp: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by kycTaker', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, requiredSwapBadges: ['kyc'] });
        await Market.create({ network: net });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, kycTaker: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by putBadges', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({ network: net, requiredPutBadges: ['kyc'] });
        const market2 = await Market.create({ network: net, requiredPutBadges: ['merchant/africa'] });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, putBadges: 'kyc' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, putBadges: 'kyc, merchant/africa' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, putBadges: 'merchant/' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market2.id);
          });
      });
    });

    describe('limit=1', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          quoteAddress: '0xQuoteAddress',
          updatedAt: moment().subtract(2, 's').toISOString(),
        });
        await Market.create({
          network: net,
          updatedAt: moment().subtract(3, 's').toISOString(),
        });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('offset is set', () => {
      it('should 200 and correct market', async () => {
        await Market.create({
          network: net,
          quoteAddress: '0xQuoteAddress',
          updatedAt: moment().subtract(2, 's').toISOString(),
        });
        const market = await Market.create({
          network: net,
          updatedAt: moment().subtract(3, 's').toISOString(),
        });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });
  });

  describe('.listPermittedTraders', () => {
    it('should 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123/permitted_takers`)
        .set('Authorization', 'bearer ' + token)
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

    describe('with no filter', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await PermittedTrader.create({ network: net, marketAddress: mid });
        const iv = await PermittedTrader.create({
          network: net,
          marketAddress: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_takers`)
          .set('Authorization', 'bearer ' + token)
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with limit=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await PermittedTrader.create({ network: net, marketAddress: mid });
        const iv = await PermittedTrader.create({
          network: net,
          marketAddress: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_takers`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, limit: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with offset=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        const iv = await PermittedTrader.create({
          network: net,
          marketAddress: mid,
        });
        await PermittedTrader.create({ network: net, marketAddress: mid });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_takers`)
          .set('Authorization', 'bearer ' + token)
          .query({ net, limit: 1, offset: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });
  });

  describe('.listPermittedProviders', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123/permitted_providers`)
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

    describe('with correct network', () => {
      it('should return 200 and correct result', async () => {
        const prov = await LiquidityProvider.create({
          network: net,
          marketAddress: '0x123',
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/0x123/permitted_providers`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with correct network and market ID', () => {
      it('should return 200 and correct result', async () => {
        await LiquidityProvider.create({ network: net, marketAddress: '0x000' });
        const prov = await LiquidityProvider.create({
          network: net,
          marketAddress: '0x123',
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/0x123/permitted_providers`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with limit specified', () => {
      it('should return 200 and correct result', async () => {
        await LiquidityProvider.create({
          network: net,
          marketAddress: '0x123',
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        const prov = await LiquidityProvider.create({
          network: net,
          marketAddress: '0x123',
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/0x123/permitted_providers`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with offset specified', () => {
      it('should return 200 and correct result', async () => {
        const prov = await LiquidityProvider.create({
          sn: 1,
          network: net,
          marketAddress: '0x123',
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        await LiquidityProvider.create({
          sn: 2,
          network: net,
          marketAddress: '0x123',
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/0x123/permitted_providers`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with count specified', () => {
      it('should return 200 and correct count', async () => {
        await LiquidityProvider.create({
          sn: 1,
          network: net,
          marketAddress: '0x123',
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        await LiquidityProvider.create({
          sn: 2,
          network: net,
          marketAddress: '0x123',
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/0x123/permitted_providers`)
          .query({ net, count: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.count).toEqual('2');
          });
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import * as request from 'supertest';
import { AssetsController } from './assets.controller';
import { setFeaturedAssets } from '../../common/featured_assets';
import { SupportedNetworks } from '../../network/common';
import Swap from '../../models/swap';
import * as moment from 'moment';
import MarketPrice from '../../models/market_price';
import Liquidity from '../../models/liquidity';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('AssetsController', () => {
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

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AssetsController],
      providers: [ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.getFeaturedAssetsStats', () => {
    const baseAddress = '0x0B306BF915C4d645ff596e518fAf3F9669b97016';
    const baseAddress2 = '0x0B306BF915C4d645ff596e518fAf3F9669b97017';
    beforeEach(() => {
      setFeaturedAssets([
        {
          symbol: 'BTC',
          contracts: [
            { net: SupportedNetworks.Ethereum, addr: baseAddress },
            { net: SupportedNetworks.Ethereum, addr: baseAddress2 },
          ],
        },
      ]);
    });

    describe('no volume and price information', () => {
      it('should return 200 and zero values', async () => {
        await request(app.getHttpServer())
          .get(`/v1/assets/featured`)
          .expect(200)
          .expect({
            data: [
              {
                symbol: 'BTC',
                volume24h: '0',
                price24h: 0,
                lowestPrice24h: '0',
                highestPrice24h: '0',
              },
            ],
          });
      });
    });

    describe('with volume spread across multiple networks', () => {
      it('should return 200 and correct 24h volume', async () => {
        await Swap.create({ network: 'net1', baseAddress, amount: '100' });
        await Swap.create({
          network: 'net1',
          baseAddress: baseAddress2,
          amount: '100',
        });
        await Swap.create({
          network: 'net2',
          baseAddress: baseAddress2,
          amount: '100',
          createdAt: moment().subtract(24, 'h').toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/assets/featured`)
          .expect(200)
          .expect({
            data: [
              {
                symbol: 'BTC',
                volume24h: '200',
                price24h: 0,
                lowestPrice24h: '0',
                highestPrice24h: '0',
              },
            ],
          });
      });
    });

    describe('check 24h price change', () => {
      it('should return 200 and correct 24h price change', async () => {
        await Swap.create({ network: 'net1', baseAddress, amount: '100' });
        await MarketPrice.create({
          baseAddress,
          price: '100',
          createdAt: moment().subtract(24, 'h').toISOString(),
        });
        await MarketPrice.create({
          baseAddress,
          price: '200',
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/assets/featured`)
          .expect(200)
          .expect({
            data: [
              {
                symbol: 'BTC',
                volume24h: '100',
                price24h: 100,
                lowestPrice24h: '0',
                highestPrice24h: '0',
              },
            ],
          });
      });
    });

    describe('check highest and lowest prices', () => {
      it('should return 200 and correct 24h lowest and highest price', async () => {
        await Swap.create({ network: 'net1', baseAddress, amount: '100' });
        await MarketPrice.create({
          baseAddress,
          price: '100',
          createdAt: moment().subtract(24, 'h').toISOString(),
        });
        await MarketPrice.create({
          baseAddress,
          price: '200',
        });
        await Liquidity.create({ baseAddress, price: '100', amount: '100' });
        await Liquidity.create({ baseAddress, price: '50', amount: '100' });
        await request(app.getHttpServer())
          .get(`/v1/assets/featured`)
          .expect(200)
          .expect({
            data: [
              {
                symbol: 'BTC',
                volume24h: '100',
                price24h: 100,
                lowestPrice24h: '50',
                highestPrice24h: '100',
              },
            ],
          });
      });
    });
  });

  describe('.getAssetStats', () => {
    it('should return 404 when asset is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/assets/abc`)
        .expect(404)
        .expect({
          error: { param: 'address', message: 'unknown asset' },
        });
    });

    it('should return 404 when asset is unknown', async () => {
      await Liquidity.create({
        baseAddress: '0xBaseAddress',
        base: 'XYZ',
        network: 'ethereum',
      });
      await request(app.getHttpServer())
        .get(`/v1/assets/0xBaseAddress`)
        .expect(200)
        .expect({
          data: {
            address: '0xBaseAddress',
            symbol: 'XYZ',
            volume24h: '0',
            price24h: 0,
            network: 'ethereum',
            lowestPrice24h: '0',
            highestPrice24h: '0',
          },
        });
    });
  });
});

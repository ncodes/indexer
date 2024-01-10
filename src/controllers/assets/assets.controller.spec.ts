import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { setFeaturedAssets } from '../../common/featured_assets';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotifierService } from '../../jobs/mailer/NotifierService';
import AssetRegistry from '../../models/asset_registry';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import Swap from '../../models/swap';
import { genEthAddress } from '../../network/common';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis/redis.service';
import { PointService } from '../points/point.service';
import { AssetsController } from './assets.controller';
import { AuthService } from '../auth/auth.service';

// Note: We use var because const will not jest hoist correctly.
// eslint-disable-next-line no-var
var mockFindTokenInLocalhost: jest.Mock<any, any, any>;
jest.mock('@jointlabs/chains-info', () => {
  mockFindTokenInLocalhost = jest.fn();
  const orig = jest.requireActual('@jointlabs/chains-info');
  return {
    ...orig,
    findTokenInLocalhost: mockFindTokenInLocalhost,
  };
});

const NotifierServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('AssetsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const net2 = 'binance';
  const baseAddress = genEthAddress();
  const baseAddress2 = genEthAddress();

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
    jest.resetModules();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AssetsController],
      providers: [
        ConfigService,
        MetadataService,
        NetworkService,
        NotifierService,
        ExchangeRateService,
        AuthService,
        RedisService,
        PointService,
      ],
    })
      .overrideProvider(NotifierService)
      .useValue(new NotifierServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.getFeaturedAssetsStats', () => {
    beforeEach(() => {
      setFeaturedAssets([
        {
          symbol: 'BTC',
          dominantColor: '#000000',
          contracts: [
            { net, addr: baseAddress, primary: true },
            { net: net2, addr: baseAddress2 },
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
        await Swap.create({ network: net, baseAddress, amount: '100' });
        await Swap.create({ network: net2, baseAddress: baseAddress2, amount: '100' });
        await Swap.create({
          network: net2,
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
        await Swap.create({ network: net, baseAddress, amount: '100' });
        await MarketPrice.create({
          network: net,
          baseAddress,
          price: '100',
          createdAt: moment().subtract(24, 'h').toISOString(),
        });
        await MarketPrice.create({ network: net, baseAddress, price: '200', createdAt: moment().toISOString() });
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
        await Swap.create({ network: net, baseAddress, amount: '100' });
        await MarketPrice.create({
          network: net,
          baseAddress,
          price: '100',
          createdAt: moment().subtract(24, 'h').toISOString(),
        });
        await MarketPrice.create({
          network: net,
          baseAddress,
          price: '200',
        });
        await Liquidity.create({ network: net, baseAddress, price: '100', amount: '100' });
        await Liquidity.create({ network: net, baseAddress, price: '50', amount: '100' });
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

  describe('.getTokenList', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/assets/unknown`)
        .expect(400)
        .expect({ error: { type: 'invalid_request_error', message: 'network is unknown' } });
    });

    it('should return 200 when network is known', async () => {
      await request(app.getHttpServer()).get(`/v1/assets/${net}`).expect(200);
    });
  });

  describe('.getAssetStats', () => {
    it('should return 500 when failure to get token info from metadata service', async () => {
      jest.spyOn(app.get(MetadataService), 'getTokenInfo').mockRejectedValue(new Error('error'));
      await request(app.getHttpServer())
        .get(`/v1/assets/net1/${genEthAddress()}`)
        .expect(500)
        .expect({ error: { type: 'api_error', message: 'server error' } });
    });

    it('should return 404 when asset is unknown', async () => {
      jest.spyOn(app.get(MetadataService), 'getTokenInfo').mockResolvedValue(undefined);
      await request(app.getHttpServer())
        .get(`/v1/assets/net1/${genEthAddress()}`)
        .expect(404)
        .expect({ error: { message: 'token not found' } });
    });

    it('should return 200 and correct stats', async () => {
      await Swap.create({ network: net, baseAddress, amount: '100' });
      await MarketPrice.create({
        network: net,
        baseAddress,
        price: '1',
        createdAt: moment().subtract(1, 'd').toISOString(),
      });
      await MarketPrice.create({ network: net, baseAddress, price: '2' });

      mockFindTokenInLocalhost.mockReturnValue({
        address: baseAddress,
        symbol: 'ABC',
        volume24h: '0',
        price24h: 0,
        network: net,
      });

      await request(app.getHttpServer())
        .get(`/v1/assets/${net}/${baseAddress}`)
        .expect(200)
        .expect({
          data: {
            address: baseAddress,
            symbol: 'ABC',
            volume24h: '100',
            price24h: 100,
            network: 'ethereum',
            lowestPrice24h: '0',
            highestPrice24h: '0',
          },
        });
    });
  });

  describe('.getRegistry', function () {
    it('should return 404 when registry info was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/assets/registry/${net}/${baseAddress}`)
        .expect(404)
        .expect({ error: { message: 'registry info not found' } });
    });

    it('should return 200 when registry info exist', async () => {
      const assetReg = await AssetRegistry.create({ network: net, address: baseAddress, curRate: '10' });
      await request(app.getHttpServer())
        .get(`/v1/assets/registry/${net}/${baseAddress}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(assetReg.id);
        });
    });
  });
});

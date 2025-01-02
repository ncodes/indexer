import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { isLocal, toDec } from '../../common/common';
import { AuthService } from '../../controllers/auth/auth.service';
import { DBService } from '../../db/db.service';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../exchange_rate.service';
import { RedisService } from '../redis/redis.service';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { MetadataService } from './metadata.service';

const mockGet = jest.fn();
const mockRedisService = jest.fn().mockImplementation(() => {
  return {
    get: mockGet,
    setEx: jest.fn(),
  };
});

const MockNotifierService = jest.fn().mockImplementation(() => {
  return {};
});

const mockGetConfig = jest.fn();
const MockConfigService = jest.fn().mockImplementation(() => {
  return {
    get: mockGetConfig,
  };
});

// eslint-disable-next-line no-var
var mockFindTokenInSynthetic: jest.Mock<any, any, any>;
// eslint-disable-next-line no-var
var mockFindTokenInLocalhost: jest.Mock<any, any, any>;
jest.mock('@jointlabs/meta', () => {
  mockFindTokenInSynthetic = jest.fn();
  mockFindTokenInLocalhost = jest.fn();
  const orig = jest.requireActual('@jointlabs/meta');
  return {
    ...orig,
    findTokenInSynthetic: mockFindTokenInSynthetic,
    findTokenInLocalhost: mockFindTokenInLocalhost,
  };
});

if (process.env.TEST_EXTERNAL_API == 'true' || isLocal()) {
  describe('Metadata Tests', () => {
    let service: MetadataService;
    const db = DBService.getForTest();
    let module: TestingModule;

    beforeEach(async () => {
      jest.clearAllMocks();
      jest.resetModules();

      mockGetConfig.mockImplementation((key) => {
        return {
          'app.tokenMetadataSource': 'coingecko',
        }[key];
      });
    });

    afterEach(async () => {
      await db.truncateTables();
    });

    afterAll(async () => {
      await db.destroy();
    });

    beforeEach(async () => {
      await db.truncateTables();

      module = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({})],
        providers: [
          ConfigService,
          NetworkService,
          MetadataService,
          ExchangeRateService,
          RedisService,
          NotificationService,
          AuthService,
        ],
      })
        .overrideProvider(RedisService)
        .useValue(new mockRedisService())
        .overrideProvider(NotificationService)
        .useValue(new MockNotifierService())
        .overrideProvider(ConfigService)
        .useValue(new MockConfigService())
        .compile();
      service = module.get<MetadataService>(MetadataService);
    });

    describe('sources', () => {
      describe('CoinMarketCapMetadata.getTokenInfo', () => {
        it('should return expected value', async () => {
          const source = new CoinMarketCapMetadata(process.env.COINMARKETCAP_KEY);
          const resp = await source.getTokenInfo('bitcoin', 'BTC');
          expect(resp).toHaveProperty('network', 'bitcoin');
          expect(resp).toHaveProperty('name', 'Bitcoin');
          expect(resp).toHaveProperty('symbol', 'BTC');
          expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
          expect(resp).toHaveProperty('decimals', 0);
          expect(resp).toHaveProperty('isContract', false);
          expect(resp).toHaveProperty('price', expect.any(Number));
        });

        it('should return expected value using address', async () => {
          const source = new CoinMarketCapMetadata(process.env.COINMARKETCAP_KEY);
          const resp = await source.getTokenInfo('', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
          expect(resp).toHaveProperty('network', 'ethereum');
          expect(resp).toHaveProperty('name', 'Uniswap');
          expect(resp).toHaveProperty('symbol', 'UNI');
          expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
          expect(resp).toHaveProperty('decimals', 0);
          expect(resp).toHaveProperty('isContract', true);
          expect(resp).toHaveProperty('address', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
          expect(resp).toHaveProperty('type', 'ERC20');
          expect(resp).toHaveProperty('price', expect.any(Number));
        });
      });

      describe('CoinGeckoMetadata.getTokenInfo', () => {
        it('should return expected value', async () => {
          const source = new CoinGeckoMetadata();
          const resp = await source.getTokenInfo('ethereum', 'ETH');
          expect(resp).toHaveProperty('network', 'ethereum');
          expect(resp).toHaveProperty('name', 'Ethereum');
          expect(resp).toHaveProperty('symbol', 'ETH');
          expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
          expect(resp).toHaveProperty('decimals', 0);
          expect(resp).toHaveProperty('isContract', false);
          expect(resp).toHaveProperty('price', expect.any(Number));
        });

        it('should return expected value using address', async () => {
          const source = new CoinGeckoMetadata();
          const resp = await source.getTokenInfo('', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
          expect(resp).toHaveProperty('network', '');
          expect(resp).toHaveProperty('name', 'Uniswap');
          expect(resp).toHaveProperty('symbol', 'UNI');
          expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
          expect(resp).toHaveProperty('decimals', 18);
          expect(resp).toHaveProperty('isContract', true);
          expect(resp).toHaveProperty('address', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
          expect(resp).toHaveProperty('type', 'ERC20');
          expect(resp).toHaveProperty('price', expect.any(Number));
        });
      });
    });

    describe('.getTokenInfo', () => {
      describe('address exist in localhost list', () => {
        it('should return expected value', async () => {
          mockFindTokenInLocalhost.mockReturnValue({
            name: 'Bitcoin',
            symbol: 'BTC',
            address: '0xAddress',
            decimals: 8,
            logoURI: 'https://bitcoin.org/img.png',
            price: 1000,
          });

          const resp = await service.getTokenInfo('bitcoin', '0xAddress');
          expect(resp).toHaveProperty('network', 'bitcoin');
          expect(resp).toHaveProperty('name', 'Bitcoin');
          expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
          expect(resp).toHaveProperty('decimals', 8);
          expect(resp).toHaveProperty('price', 1000);
        });
      });

      describe('address exist in synthetic list', () => {
        it('should return expected value when isSynthetic = true', async () => {
          mockFindTokenInSynthetic.mockReturnValue({
            name: 'Naira',
            symbol: 'NGN',
            address: '0xAddress',
            decimals: 8,
            logoURI: 'https://bitcoin.org/img.png',
            isSynthetic: true,
          });

          jest.spyOn(module.get(ExchangeRateService), 'tryGet').mockResolvedValue(toDec(1000));

          const resp = await service.getTokenInfo('network', '0xAddress');
          expect(resp).toHaveProperty('network', 'network');
          expect(resp).toHaveProperty('name', 'Naira');
          expect(resp).toHaveProperty('logoURI', 'https://bitcoin.org/img.png');
          expect(resp).toHaveProperty('decimals', 8);
          expect(resp).toHaveProperty('price', 1000);
        });

        it('should return expected value when isSynthetic = false or undefined', async () => {
          mockFindTokenInSynthetic.mockReturnValue({
            name: 'Naira',
            symbol: 'NGN',
            address: '0xAddress',
            decimals: 8,
            logoURI: 'https://bitcoin.org/img.png',
            isSynthetic: false,
            price: 1000,
          });

          const resp = await service.getTokenInfo('network', '0xAddress');
          expect(resp).toHaveProperty('network', 'network');
          expect(resp).toHaveProperty('name', 'Naira');
          expect(resp).toHaveProperty('logoURI', 'https://bitcoin.org/img.png');
          expect(resp).toHaveProperty('decimals', 8);
          expect(resp).toHaveProperty('price', 1000);
        });
      });

      describe('address exist in redis cache', () => {
        it('should return expected value', async () => {
          mockGet.mockResolvedValue(
            JSON.stringify({
              network: 'network',
              name: 'Naira',
              symbol: 'NGN',
              address: '0xAddress',
              decimals: 8,
              logoURI: 'https://bitcoin.org/img.png',
              price: 1000,
            }),
          );

          const resp = await service.getTokenInfo('network', '0xAddress');
          expect(resp).toHaveProperty('network', 'network');
          expect(resp).toHaveProperty('name', 'Naira');
          expect(resp).toHaveProperty('logoURI', 'https://bitcoin.org/img.png');
          expect(resp).toHaveProperty('decimals', 8);
          expect(resp).toHaveProperty('price', 1000);
        });
      });
    });
  });
}

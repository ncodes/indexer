import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as _ from 'lodash';
import { isLocal, toDec } from '../../common/common';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { TokenLists } from '../../common/token_list';
import { DBService } from '../../db/DBService';
import { NotifierService } from '../../jobs/mailer/NotifierService';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../exchange_rate.service';
import { RedisService } from '../redis.service';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { MetadataService } from './metadata.service';

const mockGet = jest.fn();
const mockRedisService = jest.fn().mockImplementation(() => {
  return {
    get: mockGet,
  };
});

const MockNotifierService = jest.fn().mockImplementation(() => {
  return {};
});

if (process.env.TEST_EXTERNAL_API == 'true' || isLocal()) {
  describe('Metadata Tests', () => {
    let app: INestApplication;
    let service: MetadataService;
    const db = DBService.getForTest();
    let localListCopy: TokenList.Token[];
    let syntheticListCopy: TokenList.Token[];
    let module: TestingModule;

    afterEach(async () => {
      TokenLists.localhost.tokens = localListCopy;
      TokenLists.synthetic.tokens = syntheticListCopy;
      await db.truncateTables();
    });

    afterAll(async () => {
      jest.resetAllMocks();
      await app.close();
      await db.destroy();
    });

    beforeEach(async () => {
      await db.truncateTables();

      localListCopy = _.clone(TokenLists.localhost.tokens);
      syntheticListCopy = _.clone(TokenLists.synthetic.tokens);

      module = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({})],
        providers: [ConfigService, NetworkService, MetadataService, ExchangeRateService, RedisService, NotifierService],
      })
        .overrideProvider(RedisService)
        .useValue(new mockRedisService())
        .overrideProvider(NotifierService)
        .useValue(new MockNotifierService())
        .compile();

      app = module.createNestApplication();
      app.useLogger(new NoopLogger());
      service = module.get<MetadataService>(MetadataService);
      await app.init();
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
          TokenLists.localhost.tokens.push({
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
        it('should return expected value', async () => {
          TokenLists.synthetic.tokens.push({
            name: 'Naira',
            symbol: 'NGN',
            address: '0xAddress',
            decimals: 8,
            logoURI: 'https://bitcoin.org/img.png',
          });

          jest.spyOn(module.get(ExchangeRateService), 'tryGet').mockResolvedValue(toDec(1000));

          const resp = await service.getTokenInfo('network', '0xAddress');
          expect(resp).toHaveProperty('network', 'network');
          expect(resp).toHaveProperty('name', 'Naira');
          expect(resp).toHaveProperty('logoURI', 'https://bitcoin.org/img.png');
          expect(resp).toHaveProperty('decimals', 8);
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

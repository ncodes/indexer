import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/DBService';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import { isLocal } from '../../common/common';

if (process.env.TEST_EXTERNAL_API == 'true' || isLocal()) {
  describe('Metadata Tests', () => {
    let app: INestApplication;
    const db = DBService.getForTest();

    afterEach(async () => {
      await db.truncateTables();
    });

    afterAll(async () => {
      await db.destroy();
      await app.close();
    });

    beforeEach(async () => {
      await db.truncateTables();

      const module: TestingModule = await Test.createTestingModule({
        imports: [],
        providers: [],
      }).compile();

      app = module.createNestApplication();
      app.useLogger(new NoopLogger());
      await app.init();
    });

    describe('CoinMarketCapMetadata.getTokenInfo', () => {
      it('should return expected value', async () => {
        const source = new CoinMarketCapMetadata(process.env.COINMARKETCAP_KEY);
        const resp = await source.getTokenInfo('bitcoin', 'BTC');
        expect(resp).toHaveProperty('network', 'bitcoin');
        expect(resp).toHaveProperty('name', 'Bitcoin');
        expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
        expect(resp).toHaveProperty('decimals', 0);
        expect(resp).toHaveProperty('isContract', false);
        expect(resp).toHaveProperty('price', expect.any(Number));
      });
    });

    describe('CoinGeckoMetadata.getTokenInfo', () => {
      it('should return expected value', async () => {
        const source = new CoinGeckoMetadata();
        const resp = await source.getTokenInfo('bitcoin', 'BTC');
        expect(resp).toHaveProperty('network', 'bitcoin');
        expect(resp).toHaveProperty('name', 'Bitcoin');
        expect(resp).toHaveProperty('logoURI', expect.stringMatching('https://.*'));
        expect(resp).toHaveProperty('decimals', 0);
        expect(resp).toHaveProperty('isContract', false);
        expect(resp).toHaveProperty('price', expect.any(Number));
      });
    });
  });
}

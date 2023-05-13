import * as moment from 'moment';
import MarketPrice from './market_price';
import { DBService } from '../db/DBService';

describe('MarketPrice', () => {
  const db = DBService.getForTest();

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.priceChange', () => {
    describe('no provider address provided', () => {
      it('should return correct 24 hours price change', async () => {
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x123',
          price: '100',
          createdAt: moment().subtract(86400, 's').toISOString(),
        });
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x123',
          price: '200',
        });
        expect(await MarketPrice.priceChange('net1', '0x123', undefined, 24)).toEqual(100);

        // No price outside the last 24 hours for market=0x123
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x1234',
          price: '100',
          createdAt: moment().subtract(86400, 's').toISOString(),
        });
        await MarketPrice.create({
          network: 'net2',
          marketAddress: '0x123',
          price: '200',
        });
        expect(await MarketPrice.priceChange('net2', '0x123', undefined, 24)).toEqual(0);
      });
    });

    describe('provider address was provided', () => {
      it('should return correct 24 hours price change', async () => {
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x123',
          provider: '0xProvider',
          price: '100',
          createdAt: moment().subtract(86400, 's').toISOString(),
        });
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x123',
          provider: '0xProvider',
          price: '200',
        });
        expect(await MarketPrice.priceChange('net1', '0x123', '0xWrongProvider', 24)).toEqual(0);
        expect(await MarketPrice.priceChange('net1', '0x123', '0xProvider', 24)).toEqual(100);

        // No price outside the last 24 hours for market=0x123
        await MarketPrice.create({
          network: 'net1',
          marketAddress: '0x1234',
          provider: '0xProvider',
          price: '100',
          createdAt: moment().subtract(86400, 's').toISOString(),
        });
        await MarketPrice.create({
          network: 'net2',
          marketAddress: '0x123',
          provider: '0xProvider',
          price: '200',
        });
        expect(await MarketPrice.priceChange('net2', '0x123', '0xWrongProvider', 24)).toEqual(0);
        expect(await MarketPrice.priceChange('net2', '0x123', '0xProvider', 24)).toEqual(0);
      });
    });
  });
});

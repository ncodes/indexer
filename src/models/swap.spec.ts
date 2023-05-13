import { DBService } from '../db/DBService';
import Swap from './swap';

describe('MarketPrice', () => {
  const db = DBService.getForTest();
  const net = 'net1';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.getCompletionRate', () => {
    it('should return correct rate', async () => {
      await Swap.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        released: true,
      });
      await Swap.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
        released: true,
        byDispute: true,
      });
      await Swap.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider',
      });
      await Swap.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProvider2',
        released: true,
      });
      expect(await Swap.getCompletionRate(net, '0xMarket', '0xProvider')).toEqual(33.33);
      expect(await Swap.getCompletionRate(net, '0xMarket', undefined)).toEqual(50);
    });
  });
});

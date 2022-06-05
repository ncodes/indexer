import { MarketCoreHandler } from './market_core.handler';
import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import { Contract, ContractInterface, Signer } from 'ethers';
import { Provider } from '@ethersproject/abstract-provider';
import { NoopLogger } from '../../common/loggers/noop_logger';

const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {};
});

describe('MarketCoreHandler', () => {
  const db = DBService.getForTest();
  let handler: MarketCoreHandler;
  const marketCoreContract = new MarketCoreContract();
  const contracts = {
    marketCore: marketCoreContract,
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new MarketCoreHandler(null, 'net', contracts);
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onNewMarket', () => {
    it('should create market', async () => {
      const creator = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const baseAsset = '0x076BCfCf983C9E22d5785C177e7473BF608c4eC1';
      const quoteAsset = '0x75A3Feece9E1CE14807feff83Da432a32a1de14F';

      const mockBaseContract = {
        symbol: jest.fn().mockResolvedValue('BTC'),
      };
      const mockQuoteContract = {
        symbol: jest.fn().mockResolvedValue('USDT'),
      };

      handler.newContract = (addressOrName: string): any => {
        switch (addressOrName) {
          case baseAsset:
            return mockBaseContract;
          case quoteAsset:
            return mockQuoteContract;
        }
      };

      await expect(
        handler.onNewMarket(
          '0x123',
          creator,
          baseAsset,
          quoteAsset,
          true,
          true,
          {} as any,
        ),
      ).resolves.toBeUndefined();
      const market = await Market.getByMarketId('0x123');
      expect(market).toBeDefined();
      expect(market.network).toEqual(handler.network);
      expect(market.creator).toEqual(creator);
      expect(market.base).toEqual('BTC');
      expect(market.baseAddress).toEqual(baseAsset);
      expect(market.quoteAddress).toEqual(quoteAsset);
      expect(market.quote).toEqual('USDT');
      expect(market.isBaseLocal).toBeTruthy();
      expect(market.isQuoteLocal).toBeTruthy();
      expect(market.pair).toEqual('BTCUSDT');
    });
  });
});

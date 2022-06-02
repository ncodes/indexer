import { NoopLogger } from '../common/loggers/noop_logger';
import { DBService } from '../db/DBService';
import Market from '../models/market';
import { MarketCoreHandler } from './market_core.handler';

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
    handler = new MarketCoreHandler(contracts);
    handler.logger = new NoopLogger();
    await db.truncateTables();
  });

  describe('.onNewMarket', () => {
    it('should create market', async () => {
      await expect(
        handler.onNewMarket('mid', '0x1', 'BTC', 'ETH', {
          blockNumber: 1,
          blockHash: '0xHash',
        }),
      ).resolves.toBeUndefined();
      const market = await Market.getByMarketId('mid');
      expect(market).toBeDefined();
      expect(market.creator).toEqual('0x1');
      expect(market.base).toEqual('BTC');
      expect(market.quote).toEqual('ETH');
    });
  });
});

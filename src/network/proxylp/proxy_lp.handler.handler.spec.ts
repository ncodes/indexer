import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Liquidity from '../../models/liquidity';
import { ProxyLPHandler } from './proxy_lp.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('ProxyLPHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: ProxyLPHandler;
  const contracts = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
    jest.clearAllMocks();
    handler = new ProxyLPHandler(null, net, contracts);
    handler.logger = new NoopLogger() as any;
  });

  describe('.onUpdatedFungibleLiquidity', function () {
    it('should update contract params correctly', async () => {
      let liq = await Liquidity.create({
        network: net,
        marketAddress: '0xMarket',
        provider: '0xProxy',
        lid: 0,
        amount: '100',
      });

      await expect(
        handler.onUpdatedFungibleLiquidity(liq.marketAddress, 0n, '0xOwner', 100n, {
          address: '0xProxy',
        } as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.getById(liq.id);
      expect(liq.proxy).toBeTruthy();
      expect(liq.proxyProvider).toEqual('0xOwner');
    });
  });
});

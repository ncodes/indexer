import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { BigNumber } from 'ethers';
import Liquidity from '../../models/liquidity';

const CoreContract = jest.fn().mockImplementation(() => {
  return {};
});

describe('CoreHandler', () => {
  const db = DBService.getForTest();
  let handler: CoreHandler;
  const coreContract = new CoreContract();
  const contracts = {
    core: coreContract,
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new CoreHandler(null, 'net', contracts);
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onUpdatedLiquidity', () => {
    describe('when deduction=false', () => {
      it(
        'should create new liquidity entry when the provider does not have' +
          ' existing liquidity in the market',
        async () => {
          await expect(
            handler.onUpdatedLiquidity(
              '0xProvider',
              '0x123',
              false,
              BigNumber.from(1000),
              BigNumber.from(3),
              BigNumber.from(100),
              BigNumber.from(300),
              BigNumber.from(0),
              {} as any,
            ),
          ).resolves.toBeUndefined();
          const liq = await Liquidity.getLiquidity(handler.network, '0x123', '0xProvider');
          expect(liq).toBeDefined();
        },
      );

      it(
        'should update existing liquidity when the provider has an existing' +
          ' liquidity in the market',
        async () => {
          await Liquidity.create({
            provider: '0xProvider',
            marketId: '0x123',
            amount: '1000',
          });
          await expect(
            handler.onUpdatedLiquidity(
              '0xProvider',
              '0x123',
              false,
              BigNumber.from(1000),
              BigNumber.from(3),
              BigNumber.from(100),
              BigNumber.from(300),
              BigNumber.from(0),
              {} as any,
            ),
          ).resolves.toBeUndefined();
          const liq = await Liquidity.getLiquidity(handler.network, '0x123', '0xProvider');
          expect(liq).toBeDefined();
        },
      );
    });
  });
});

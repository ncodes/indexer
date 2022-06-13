import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { BigNumber } from 'ethers';
import Liquidity from '../../models/liquidity';
import * as net from 'net';
import { NotifyType } from '../../jobs/mailer/NotifierService';

const CoreContract = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('CoreHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereumMainnet';
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
    handler = new CoreHandler(new MockNotifierService(), null, net, contracts);
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

  describe('.onSetLiquidityManager', () => {
    it('should set manager address', async () => {
      await Liquidity.create({
        network: net,
        provider: '0xProvider',
        marketId: '0xMarket',
      });
      await expect(
        handler.onSetLiquidityManager('0xMarket', '0xProvider', '0xManager', {} as any),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, '0xMarket', '0xProvider');
      expect(liq.manager).toEqual('0xManager');

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewLiquidityManager, net, '0xManager', {
        marketId: '0xMarket',
        provider: '0xProvider',
      });
    });
  });

  describe('.onRemoveLiquidityManager', () => {
    it('should clear manager address', async () => {
      await Liquidity.create({
        network: net,
        provider: '0xProvider',
        marketId: '0xMarket',
        manager: '0xManager',
      });
      await expect(
        handler.onRemoveLiquidityManager('0xMarket', '0xProvider', '0xManager', {} as any),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, '0xMarket', '0xProvider');
      expect(liq.manager).toBeNull();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.RemoveLiquidityManager, net, '0xManager', {
        marketId: '0xMarket',
        provider: '0xProvider',
      });
    });
  });
});

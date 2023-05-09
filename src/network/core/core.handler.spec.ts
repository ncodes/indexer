import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { BigNumber } from 'ethers';
import Liquidity from '../../models/liquidity';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import Meta from '../../models/meta';
import Market from '../../models/market';
import Swap from '../../models/swap';
import MarketPrice from '../../models/market_price';
import Dispute from '../../models/dispute';
import { toBN } from '../common';
import * as moment from 'moment';
import MineTask, { MineTaskType } from '../../models/mine_task';
import User from '../../models/user';

const CoreContract = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockGetSwapFeeInfo = jest.fn();
const mockGetTokenDecimals = jest.fn();
const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    getSwapFeeInfo: mockGetSwapFeeInfo,
    getTokenDecimals: mockGetTokenDecimals,
  };
});

describe('CoreHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: CoreHandler;
  const coreContract = new CoreContract();
  const contracts = {
    core: coreContract,
  };
  const cfg = { transferToFeePoolInterval: '86400' };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new CoreHandler(
      new MockNetworkService(),
      new MockNotifierService(),
      null,
      net,
      contracts,
    );
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };
    await db.truncateTables();
  });

  describe('.onUpdatedLiquidity', () => {
    describe('when deduction=false', () => {
      it('should create new liquidity entry when the provider has none', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0x123',
          base: 'BASE',
          baseAddress: '0xBASE',
          quote: 'QUOTE',
          quoteAddress: '0xQuote',
        });
        const user = await User.create({
          address: '0xProvider',
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
        expect(liq.base).toEqual(market.base);
        expect(liq.baseAddress).toEqual(market.baseAddress);
        expect(liq.quote).toEqual(market.quote);
        expect(liq.quoteAddress).toEqual(market.quoteAddress);
        expect(liq.provider).toEqual('0xProvider');
      });

      it('should update existing liquidity when the provider has an existing one', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0x123',
          base: 'BASE',
          baseAddress: '0xBASE',
          quote: 'QUOTE',
          quoteAddress: '0xQuote',
        });
        await Liquidity.create({
          network: net,
          marketId: market.marketId,
          provider: '0xProvider',
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
        expect(liq.provider).toEqual('0xProvider');
        expect(liq.amount).toEqual('2000');
      });
    });
  });

  describe('.onUpdatedPrice', () => {
    it('should return error when liquidity was not found locally', async () => {
      await expect(
        handler.onUpdatedPrice(
          '0xMarket',
          '0xProvider',
          '0xManager',
          BigNumber.from(100),
          {} as any,
        ),
      ).rejects.toEqual(new Error('liquidity not found'));
    });

    it('should update liquidity price and add a new market price entry', async () => {
      let liq = await Liquidity.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xProvider',
        amount: '10000',
        price: '200',
      });
      await expect(
        handler.onUpdatedPrice(
          '0xMarket',
          '0xProvider',
          '0xManager',
          BigNumber.from(100),
          {} as any,
        ),
      ).resolves.toBeUndefined();

      liq = await Liquidity.find({ id: liq.id });
      expect(liq.price).toEqual('100');

      const marketPrice = await MarketPrice.find({ marketId: liq.marketId });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.price).toEqual('100');
      expect(marketPrice.provider).toEqual(liq.provider);
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

  describe('.onProtocolFeeUpdated', () => {
    it('should update correctly', async () => {
      await handler.onProtocolFeeUpdated(
        BigNumber.from(10),
        BigNumber.from(2),
        BigNumber.from(12),
        {} as any,
      );

      expect((await Meta.get(Meta.makeProtocolFeeKey(net, 'instantSwapFee'))).value).toEqual('10');
      expect((await Meta.get(Meta.makeProtocolFeeKey(net, 'syntheticSwapFee'))).value).toEqual('2');
      expect((await Meta.get(Meta.makeProtocolFeeKey(net, 'stableSwapFee'))).value).toEqual('12');
    });
  });

  describe('.onUpdatedShareableAsset', () => {
    it('should update correctly', async () => {
      await handler.onUpdatedShareableAsset(['0xAsset', '0xAsset2'], false, {} as any);
      let shareable = await Meta.get(Meta.makeSharableAssetsKey(net));
      expect(shareable).toBeDefined();
      expect(JSON.parse(shareable.value)).toHaveProperty('0xAsset');
      expect(JSON.parse(shareable.value)).toHaveProperty('0xAsset2');

      await handler.onUpdatedShareableAsset(['0xAsset'], true, {} as any);
      shareable = await Meta.get(Meta.makeSharableAssetsKey(net));
      expect(JSON.parse(shareable.value)).not.toHaveProperty('0xAsset');
      expect(JSON.parse(shareable.value)).toHaveProperty('0xAsset2');
    });
  });

  describe('.onRegStableAsset', () => {
    it('should update correctly', async () => {
      await handler.onRegStableAsset('0xAsset', {} as any);
      const meta = await Meta.get(Meta.makeStableAssetsKey(net));
      expect(meta).toBeDefined();
      expect(JSON.parse(meta.value)).toHaveProperty('0xAsset');
    });
  });

  describe('.onVerifiedAsset', () => {
    it('should update correctly', async () => {
      await handler.onVerifiedAsset('0xAsset', {} as any);
      const meta = await Meta.get(Meta.makeVerifiedAssetsKey(net));
      expect(meta).toBeDefined();
      expect(JSON.parse(meta.value)).toHaveProperty('0xAsset');
    });
  });

  describe('.onSwapOrder', () => {
    it('should create swap correctly and send notification to liquidity provider', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        isBaseLocal: false,
        totalSwaps: 1,
      });

      await Liquidity.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xProvider',
        amount: '1000000000000000000000',
        totalSwaps: 1,
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      await handler.onSwapOrder(
        '0xMarket',
        '0xProvider',
        '0xSwapper',
        BigNumber.from(0),
        BigNumber.from('10000000000000000000'),
        BigNumber.from('1000000000000000000'),
        { transactionHash: '0xTxHash' } as any,
      );

      expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewOffChainSwap, net, '0xProvider', {
        marketId: '0xMarket',
        orderId: 0,
        provider: '0xProvider',
        base: market.base,
        quote: market.quote,
        isBaseLocal: market.isBaseLocal,
        amount: '10.0',
        cost: '10.0',
      });

      const swap = await Swap.getByOrderId(0);
      expect(swap).toBeDefined();
      expect(swap.marketId).toEqual(market.marketId);
      expect(swap.txHash).toEqual('0xTxHash');

      const liq = await Liquidity.getLiquidity(net, '0xMarket', '0xProvider');
      expect(liq.openOrders).toEqual(1);
      expect(liq.amount).toEqual('990000000000000000000');
      expect(liq.totalSwaps).toEqual(2);

      const mar = await Market.getById(market.id);
      expect(mar.totalSwaps).toEqual(2);
    });
  });

  describe('.onSwap', () => {
    describe('when orderId is unset (instant swap)', () => {
      it(
        'should create instant swap correctly and send notification to' + ' liquidity provider',
        async () => {
          let market = await Market.create({
            network: net,
            marketId: '0xMarket',
            base: 'BASE',
            quote: 'QUOTE',
            isBaseLocal: false,
            amountSwapped: '10',
            totalSwaps: 1,
          });

          let liq = await Liquidity.create({
            network: net,
            marketId: '0xMarket',
            provider: '0xProvider',
            amount: '1000000000000000000000',
            amountSwapped: '10',
          });

          mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
          mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

          await handler.onSwap(
            '0xMarket',
            BigNumber.from(0),
            '0xProvider',
            '0xSwapper',
            BigNumber.from('10000000000000000000'),
            BigNumber.from('1000000000000000000'),
            false,
            { transactionHash: '0xTxHash' } as any,
          );

          expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewInstantSwap, net, '0xProvider', {
            marketId: '0xMarket',
            provider: '0xProvider',
            base: market.base,
            quote: market.quote,
            amount: '10.0',
            cost: '10.0',
          });

          const swap = await Swap.find({ marketId: market.marketId });
          expect(swap).toBeDefined();
          expect(swap.marketId).toEqual(market.marketId);
          expect(swap.instant).toBeTruthy();
          expect(swap.txHash).toEqual('0xTxHash');

          liq = await Liquidity.getById(liq.id);
          expect(liq.amount).toEqual('990000000000000000000');
          expect(liq.lastSwapAt).toBeDefined();
          expect(liq.amountSwapped).toEqual('10000000000000000010');
          expect(liq.totalSwaps).toEqual(1);

          market = await Market.getById(market.id);
          expect(market.lastSwapAt).toBeDefined();
          expect(market.amountSwapped).toEqual('10000000000000000010');
          expect(market.totalSwaps).toEqual(2);
        },
      );
    });

    describe('when orderId is set (released)', () => {
      it('should create swap, mark it as released and send notification to taker', async () => {
        let market = await Market.create({
          network: net,
          marketId: '0xMarket',
          base: 'BASE',
          quote: 'QUOTE',
          isBaseLocal: false,
          totalSwaps: 1,
        });

        await Liquidity.create({
          network: net,
          marketId: '0xMarket',
          provider: '0xProvider',
          openOrders: 1,
          totalSwaps: 1,
        });

        const orderId = BigNumber.from(1);
        const amount = BigNumber.from('10000000000000000000');
        const cost = BigNumber.from('10000000000000000000');
        await Swap.create({
          network: net,
          marketId: market.marketId,
          orderId: orderId.toNumber() - 1,
          amount: amount.toString(),
          cost: cost.toString(),
          provider: `0xProvider`,
          byDispute: true,
        });

        await Dispute.create({
          network: net,
          marketId: market.marketId,
          orderId: orderId.toNumber() - 1,
          disputeId: 0,
        });
        let dispute = await Dispute.create({
          network: net,
          marketId: market.marketId,
          orderId: orderId.toNumber() - 1,
          disputeId: 1,
        });

        mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
        mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

        await handler.onSwap(
          '0xMarket',
          orderId,
          '0xProvider',
          '0xSwapper',
          amount,
          BigNumber.from('1000000000000000000'),
          false,
          {} as any,
        );

        expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderReleased, net, '0xProvider', {
          marketId: '0xMarket',
          base: market.base,
          quote: market.quote,
          amount: '10.0',
          cost: '10.0',
          orderId: 0,
          byDispute: false,
        });

        const swap = await Swap.find({ marketId: market.marketId });
        expect(swap).toBeDefined();
        expect(swap.marketId).toEqual(market.marketId);
        expect(swap.instant).toBeFalsy();
        expect(swap.released).toBeTruthy();

        // decrement open orders by 1
        const liq = await Liquidity.getLiquidity(net, '0xMarket', '0xProvider');
        expect(liq.openOrders).toEqual(0);
        expect(liq.lastSwapAt).toBeDefined();
        expect(liq.amountSwapped).toEqual(amount.toString());
        expect(liq.totalSwaps).toEqual(1);

        // should not update completion rate since swap was disputed
        expect(liq.completionRate).toEqual(0);

        market = await Market.getById(market.id);
        expect(market.lastSwapAt).toBeDefined();
        expect(market.amountSwapped).toEqual(amount.toString());
        expect(market.totalSwaps).toEqual(1);

        // should not update completion rate since swap was disputed
        expect(market.completionRate).toEqual(0);

        dispute = await Dispute.getById(dispute.id);
        expect(dispute.orderReleased).toBeTruthy();
      });

      describe('when not disputed', () => {
        it('should create swap, mark it as released and send notification to taker', async () => {
          let market = await Market.create({
            network: net,
            marketId: '0xMarket',
            base: 'BASE',
            quote: 'QUOTE',
            isBaseLocal: false,
            totalSwaps: 1,
          });

          await Liquidity.create({
            network: net,
            marketId: '0xMarket',
            provider: '0xProvider',
            openOrders: 1,
            totalSwaps: 1,
          });

          const orderId = BigNumber.from(1);
          const amount = BigNumber.from('10000000000000000000');
          const cost = BigNumber.from('10000000000000000000');
          await Swap.create({
            network: net,
            marketId: market.marketId,
            orderId: orderId.toNumber() - 1,
            amount: amount.toString(),
            cost: cost.toString(),
            provider: `0xProvider`,
          });

          mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
          mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

          await handler.onSwap(
            '0xMarket',
            orderId,
            '0xProvider',
            '0xSwapper',
            amount,
            BigNumber.from('1000000000000000000'),
            false,
            {} as any,
          );

          expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderReleased, net, '0xProvider', {
            marketId: '0xMarket',
            base: market.base,
            quote: market.quote,
            amount: '10.0',
            cost: '10.0',
            orderId: 0,
            byDispute: false,
          });

          const swap = await Swap.find({ marketId: market.marketId });
          expect(swap).toBeDefined();
          expect(swap.marketId).toEqual(market.marketId);
          expect(swap.instant).toBeFalsy();
          expect(swap.released).toBeTruthy();

          // decrement open orders by 1
          const liq = await Liquidity.getLiquidity(net, '0xMarket', '0xProvider');
          expect(liq.openOrders).toEqual(0);
          expect(liq.lastSwapAt).toBeDefined();
          expect(liq.amountSwapped).toEqual(amount.toString());
          expect(liq.totalSwaps).toEqual(1);

          // should update completion rate since swap was not disputed
          expect(liq.completionRate).toEqual(100);

          market = await Market.getById(market.id);
          expect(market.lastSwapAt).toBeDefined();
          expect(market.amountSwapped).toEqual(amount.toString());
          expect(market.totalSwaps).toEqual(1);

          // should update completion rate since swap was not disputed
          expect(market.completionRate).toEqual(100);
        });
      });
    });
  });

  describe('.onOrderCancelled', () => {
    it('should mark order as cancelled and send notification to counterparty', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        isBaseLocal: false,
      });

      await Liquidity.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xProvider',
        openOrders: 1,
        amount: '990000000000000000000',
      });

      const orderId = BigNumber.from(1);
      const amount = BigNumber.from('10000000000000000000');
      const cost = BigNumber.from('10000000000000000000');
      await Swap.create({
        network: net,
        marketId: market.marketId,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        cost: cost.toString(),
        provider: '0xProvider',
        taker: '0xTaker',
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      const byDispute = false;
      await handler.onOrderCancelled(orderId, '0xProvider', byDispute, {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderCancelled, net, '0xTaker', {
        marketId: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: '10.0',
        cost: '10.0',
      });

      const swap = await Swap.find({ marketId: market.marketId });
      expect(swap).toBeDefined();
      expect(swap.cancelled).toBeTruthy();

      // decrement open orders by 1 and add swap amount back to liquidity amount
      let liq = await Liquidity.getLiquidity(net, '0xMarket', '0xProvider');
      expect(liq.openOrders).toEqual(0);
      expect(liq.amount).toEqual('1000000000000000000000');

      // Should send to 0xProvider when canceller is 0xTaker
      await handler.onOrderCancelled(orderId, '0xTaker', byDispute, {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderCancelled, net, '0xProvider', {
        marketId: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: '10.0',
        cost: '10.0',
      });

      // decrement open orders by 1
      liq = await Liquidity.getLiquidity(net, '0xMarket', '0xProvider');
      expect(liq.openOrders).toEqual(-1);
      expect(liq.amount).toEqual('1010000000000000000000');
    });
  });

  describe('.onSwapOrderPaid', () => {
    it('should mark order as paid and send notification to counterparty', async () => {
      const market = await Market.create({
        network: net,
        marketId: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        isBaseLocal: false,
      });

      const orderId = BigNumber.from(1);
      const amount = BigNumber.from('10000000000000000000');
      const cost = BigNumber.from('10000000000000000000');
      await Swap.create({
        network: net,
        marketId: market.marketId,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        cost: cost.toString(),
        provider: '0xProvider',
        taker: '0xTaker',
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      await handler.onSwapOrderPaid(market.marketId, orderId, BigNumber.from(0), {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderPaid, net, '0xProvider', {
        marketId: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        amount: '10.0',
        cost: '10.0',
      });

      const swap = await Swap.find({ marketId: market.marketId });
      expect(swap).toBeDefined();
      expect(swap.paid).toBeTruthy();

      // Should send to 0xTarker when isBaseLocal=true
      await Market.updateById(market.id, { isBaseLocal: true });
      await handler.onSwapOrderPaid(market.marketId, orderId, BigNumber.from(0), {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderPaid, net, '0xTaker', {
        marketId: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        amount: '10.0',
        cost: '10.0',
      });
    });
  });

  describe('.onTogglePause', () => {
    it('should update liquidity `paused` state', async () => {
      let liq = await Liquidity.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xProvider',
        paused: false,
      });
      await expect(
        handler.onTogglePause(liq.marketId, liq.provider, true, {} as any),
      ).resolves.toBeUndefined();
      liq = await Liquidity.getById(liq.id);
      expect(liq.paused).toBeTruthy();
    });
  });

  describe('.onTransferredToFeePool', () => {
    it('should create mine task', async () => {
      const token = '0xToken';
      const amount = toBN(10);
      const now = moment().unix();
      await expect(
        handler.onTransferredToFeePool(token, amount, {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      const mineTasks = await MineTask.findAll({
        type: MineTaskType.FeeTransfer,
        transferredToken: token,
      });
      expect(mineTasks).toHaveLength(1);
      expect(moment(mineTasks[0].mineAt).isAfter(moment.unix(now))).toBeTruthy();
      expect(mineTasks[0].transferredToken).toEqual(token);
      expect(mineTasks[0].transferredAmount).toEqual(amount.toString());
    });
  });
});

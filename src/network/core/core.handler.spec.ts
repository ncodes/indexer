import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { BigNumber } from 'ethers';
import Liquidity from '../../models/liquidity';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import Meta, { FeeName } from '../../models/meta';
import Market, { AssetType } from '../../models/market';
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
  const taker = '0xTaker';
  const provider = '0xProvider';
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
          address: '0x123',
          base: 'BASE',
          baseAddress: '0xBASE',
          quote: 'QUOTE',
          quoteAddress: '0xQuote',
        });
        const user = await User.create({ address: taker });
        await expect(
          handler.onUpdatedLiquidity(
            taker,
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
        const liq = await Liquidity.getLiquidity(handler.network, '0x123', taker);
        expect(liq).toBeDefined();
        expect(liq.base).toEqual(market.base);
        expect(liq.baseAddress).toEqual(market.baseAddress);
        expect(liq.quote).toEqual(market.quote);
        expect(liq.quoteAddress).toEqual(market.quoteAddress);
        expect(liq.provider).toEqual(taker);
      });

      it('should update existing liquidity when the provider has an existing one', async () => {
        const market = await Market.create({
          network: net,
          address: '0x123',
          base: 'BASE',
          baseAddress: '0xBASE',
          quote: 'QUOTE',
          quoteAddress: '0xQuote',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: taker,
          amount: '1000',
        });
        await expect(
          handler.onUpdatedLiquidity(
            taker,
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
        const liq = await Liquidity.getLiquidity(handler.network, '0x123', taker);
        expect(liq).toBeDefined();
        expect(liq.provider).toEqual(taker);
        expect(liq.amount).toEqual('2000');
      });
    });
  });

  describe('.onUpdatedPrice', () => {
    it('should return error when liquidity was not found locally', async () => {
      await expect(
        handler.onUpdatedPrice('0xMarket', taker, '0xManager', BigNumber.from(100), {} as any),
      ).rejects.toEqual(new Error('liquidity not found'));
    });

    it('should update liquidity price and add a new market price entry', async () => {
      let liq = await Liquidity.create({
        network: net,
        marketAddress: '0xMarket',
        provider: taker,
        amount: '10000',
        price: '200',
      });
      await expect(
        handler.onUpdatedPrice('0xMarket', taker, '0xManager', BigNumber.from(100), {} as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.find({ id: liq.id });
      expect(liq.price).toEqual('100');

      const marketPrice = await MarketPrice.find({ marketAddress: liq.marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.price).toEqual('100');
      expect(marketPrice.provider).toEqual(liq.provider);
    });
  });

  describe('.onSetLiquidityManager', () => {
    it('should set manager address', async () => {
      await Liquidity.create({
        network: net,
        provider: taker,
        marketAddress: '0xMarket',
      });
      await expect(
        handler.onSetLiquidityManager('0xMarket', taker, '0xManager', {} as any),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, '0xMarket', taker);
      expect(liq.manager).toEqual('0xManager');

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewLiquidityManager, net, '0xManager', {
        marketAddress: '0xMarket',
        provider: taker,
      });
    });
  });

  describe('.onRemoveLiquidityManager', () => {
    it('should clear manager address', async () => {
      await Liquidity.create({
        network: net,
        provider: taker,
        marketAddress: '0xMarket',
        manager: '0xManager',
      });
      await expect(
        handler.onRemoveLiquidityManager('0xMarket', taker, '0xManager', {} as any),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, '0xMarket', taker);
      expect(liq.manager).toBeNull();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.RemoveLiquidityManager, net, '0xManager', {
        marketAddress: '0xMarket',
        provider: taker,
      });
    });
  });

  describe('.onProtocolFeeUpdated', () => {
    it('should update correctly', async () => {
      await handler.onProtocolFeeUpdated(
        BigNumber.from(10),
        BigNumber.from(2),
        BigNumber.from(12),
        BigNumber.from(1),
        BigNumber.from(2),
        BigNumber.from(3),
        {} as any,
      );

      expect(
        (await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.InstantSwapFeeBp))).value,
      ).toEqual('10');
      expect((await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.SynthSwapFeeBp))).value).toEqual(
        '2',
      );
      expect((await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.StableSwapFeeBp))).value).toEqual(
        '12',
      );
      expect(
        (await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.FixedSynthSwapFee))).value,
      ).toEqual('1');
      expect((await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.FixedNFTSwapFee))).value).toEqual(
        '2',
      );
      expect(
        (await Meta.get(Meta.makeProtocolFeeKey(net, FeeName.InstantNFTSwapFeeBp))).value,
      ).toEqual('3');
    });
  });

  describe('.onSwapOrder', () => {
    it('should create swap correctly and send notification to liquidity provider', async () => {
      const market = await Market.create({
        network: net,
        address: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        baseType: AssetType.ERC20,
        totalSwaps: 1,
      });

      await Liquidity.create({
        network: net,
        marketAddress: '0xMarket',
        provider: taker,
        amount: '1000000000000000000000',
        totalSwaps: 1,
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      await handler.onSwapOrder(
        '0xMarket',
        taker,
        '0xSwapper',
        BigNumber.from(0),
        BigNumber.from('10000000000000000000'),
        BigNumber.from('1000000000000000000'),
        { transactionHash: '0xTxHash' } as any,
      );

      expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewOffChainSwap, net, taker, {
        marketAddress: '0xMarket',
        orderId: 0,
        provider: taker,
        base: market.base,
        quote: market.quote,
        baseType: market.baseType,
        amount: '10.0',
        cost: '10.0',
      });

      const swap = await Swap.getByOrderId(0);
      expect(swap).toBeDefined();
      expect(swap.marketAddress).toEqual(market.address);
      expect(swap.txHash).toEqual('0xTxHash');

      const liq = await Liquidity.getLiquidity(net, '0xMarket', taker);
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
            address: '0xMarket',
            base: 'BASE',
            quote: 'QUOTE',
            baseType: AssetType.ERC20,
            amountSwapped: '10',
            totalSwaps: 1,
          });

          let liq = await Liquidity.create({
            network: net,
            marketAddress: '0xMarket',
            provider: taker,
            amount: '1000000000000000000000',
            amountSwapped: '10',
          });

          mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
          mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

          await handler.onSwap(
            '0xMarket',
            BigNumber.from(0),
            taker,
            '0xSwapper',
            BigNumber.from('10000000000000000000'),
            BigNumber.from('1000000000000000000'),
            false,
            { transactionHash: '0xTxHash' } as any,
          );

          expect(mockNotify).toHaveBeenCalledWith(NotifyType.NewInstantSwap, net, taker, {
            marketAddress: '0xMarket',
            provider: taker,
            base: market.base,
            quote: market.quote,
            amount: '10.0',
            cost: '10.0',
          });

          const swap = await Swap.find({ marketAddress: market.address });
          expect(swap).toBeDefined();
          expect(swap.marketAddress).toEqual(market.address);
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
          address: '0xMarket',
          base: 'BASE',
          quote: 'QUOTE',
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          totalSwaps: 1,
        });

        await Liquidity.create({
          network: net,
          marketAddress: '0xMarket',
          provider,
          openOrders: 1,
          totalSwaps: 1,
        });

        const orderId = BigNumber.from(1);
        const amount = BigNumber.from('10000000000000000000');
        const cost = BigNumber.from('10000000000000000000');
        await Swap.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          amount: amount.toString(),
          cost: cost.toString(),
          provider,
          taker,
          byDispute: true,
        });

        await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          disputeId: 0,
        });
        let dispute = await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          disputeId: 1,
        });

        mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
        mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

        await handler.onSwap(
          '0xMarket',
          orderId,
          provider,
          '0xSwapper',
          amount,
          BigNumber.from('1000000000000000000'),
          false,
          {} as any,
        );

        expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderReleased, net, taker, {
          marketAddress: '0xMarket',
          base: market.base,
          quote: market.quote,
          amount: '10.0',
          cost: '10.0',
          orderId: 0,
          byDispute: false,
        });

        const swap = await Swap.find({ marketAddress: market.address });
        expect(swap).toBeDefined();
        expect(swap.marketAddress).toEqual(market.address);
        expect(swap.instant).toBeFalsy();
        expect(swap.released).toBeTruthy();

        // decrement open orders by 1
        const liq = await Liquidity.getLiquidity(net, '0xMarket', provider);
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
            address: '0xMarket',
            base: 'BASE',
            quote: 'QUOTE',
            baseType: AssetType.ERC20,
            quoteType: AssetType.SYNTH,
            totalSwaps: 1,
          });

          await Liquidity.create({
            network: net,
            marketAddress: '0xMarket',
            provider: provider,
            openOrders: 1,
            totalSwaps: 1,
          });

          const orderId = BigNumber.from(1);
          const amount = BigNumber.from('10000000000000000000');
          const cost = BigNumber.from('10000000000000000000');
          await Swap.create({
            network: net,
            marketAddress: market.address,
            orderId: orderId.toNumber() - 1,
            amount: amount.toString(),
            cost: cost.toString(),
            provider,
            taker,
          });

          mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
          mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

          await handler.onSwap(
            '0xMarket',
            orderId,
            provider,
            '0xSwapper',
            amount,
            BigNumber.from('1000000000000000000'),
            false,
            {} as any,
          );

          expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderReleased, net, taker, {
            marketAddress: '0xMarket',
            base: market.base,
            quote: market.quote,
            amount: '10.0',
            cost: '10.0',
            orderId: 0,
            byDispute: false,
          });

          const swap = await Swap.find({ marketAddress: market.address });
          expect(swap).toBeDefined();
          expect(swap.marketAddress).toEqual(market.address);
          expect(swap.instant).toBeFalsy();
          expect(swap.released).toBeTruthy();

          // decrement open orders by 1
          const liq = await Liquidity.getLiquidity(net, '0xMarket', provider);
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
        address: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        baseType: AssetType.ERC20,
      });

      await Liquidity.create({
        network: net,
        marketAddress: '0xMarket',
        provider: taker,
        openOrders: 1,
        amount: '990000000000000000000',
      });

      const orderId = BigNumber.from(1);
      const amount = BigNumber.from('10000000000000000000');
      const cost = BigNumber.from('10000000000000000000');
      await Swap.create({
        network: net,
        marketAddress: market.address,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        cost: cost.toString(),
        provider: taker,
        taker: '0xTaker',
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      const byDispute = false;
      await handler.onOrderCancelled(orderId, taker, byDispute, {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderCancelled, net, '0xTaker', {
        marketAddress: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: '10.0',
        cost: '10.0',
      });

      const swap = await Swap.find({ marketAddress: market.address });
      expect(swap).toBeDefined();
      expect(swap.cancelled).toBeTruthy();

      // decrement open orders by 1 and add swap amount back to liquidity amount
      let liq = await Liquidity.getLiquidity(net, '0xMarket', taker);
      expect(liq.openOrders).toEqual(0);
      expect(liq.amount).toEqual('1000000000000000000000');

      // Should send to 0xProvider when canceller is 0xTaker
      await handler.onOrderCancelled(orderId, '0xTaker', byDispute, {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderCancelled, net, taker, {
        marketAddress: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: '10.0',
        cost: '10.0',
      });

      // decrement open orders by 1
      liq = await Liquidity.getLiquidity(net, '0xMarket', taker);
      expect(liq.openOrders).toEqual(-1);
      expect(liq.amount).toEqual('1010000000000000000000');
    });
  });

  describe('.onSwapOrderPaid', () => {
    it('should mark order as paid and send notification to counterparty', async () => {
      const market = await Market.create({
        network: net,
        address: '0xMarket',
        base: 'BASE',
        quote: 'QUOTE',
        baseType: AssetType.ERC20,
        quoteType: AssetType.SYNTH,
      });

      const orderId = BigNumber.from(1);
      const amount = BigNumber.from('10000000000000000000');
      const cost = BigNumber.from('10000000000000000000');
      await Swap.create({
        network: net,
        marketAddress: market.address,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        cost: cost.toString(),
        provider: provider,
        taker: taker,
      });

      mockGetSwapFeeInfo.mockResolvedValue({ cost: '10000000000000000000' });
      mockGetTokenDecimals.mockResolvedValue(BigNumber.from(18));

      await handler.onSwapOrderPaid(market.address, orderId, BigNumber.from(0), {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderPaid, net, provider, {
        marketAddress: '0xMarket',
        orderId: orderId.toNumber(),
        base: market.base,
        quote: market.quote,
        amount: '10.0',
        cost: '10.0',
      });

      // Make sure swap is marked as paid
      const swap = await Swap.find({ marketAddress: market.address });
      expect(swap).toBeDefined();
      expect(swap.paid).toBeTruthy();

      // Should send to taker when base is synth and quote ERC20
      await Market.updateById(market.id, { baseType: AssetType.SYNTH, quoteType: AssetType.ERC20 });
      await handler.onSwapOrderPaid(market.address, orderId, BigNumber.from(0), {} as any);
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapOrderPaid, net, taker, {
        marketAddress: '0xMarket',
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
        marketAddress: '0xMarket',
        provider: taker,
        paused: false,
      });
      await expect(
        handler.onTogglePause(liq.marketAddress, liq.provider, true, {} as any),
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

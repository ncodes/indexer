import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { constants } from 'ethers';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import { powOf, toBN } from '../common';
import MarketPrice from '../../models/market_price';
import { NotificationID } from '../../jobs/mailer/NotifierService';
import Meta, { FeeName, MetaKeys, ProtocolFeeBeneficiary, ProtocolParams } from '../../models/meta';
import Swap from '../../models/swap';
import Dispute from '../../models/dispute';
import * as moment from 'moment';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Offer from '../../models/offers';
import MarketBadge from '../../models/market_badge';

const mockGetOrder = jest.fn();
const mockGetOffer = jest.fn();
const CoreContract = jest.fn().mockImplementation(() => {
  return {
    getOrder: mockGetOrder,
    getOffer: mockGetOffer,
  };
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockComputeSwapFees = jest.fn();
const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('CoreHandler', () => {
  const taker = '0xTaker';
  const provider = '0xProvider';
  const marketAddress = '0xMarket';
  const manager = '0xManager';
  const BASE = 'BASE';
  const QUOTE = 'QUOTE';
  const baseAddress = '0xBase';
  const quoteAddress = '0xQuote';
  const txHash = '0xTxHash';
  const userAddr = '0xUser';
  const db = DBService.getForTest();
  const net = 'ethereum';
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
    handler = new CoreHandler(new MockNetworkService(), new MockNotifierService(), null, net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.computeSwapFees = mockComputeSwapFees;

    await db.truncateTables();

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        transferToFeePoolInterval: 86400,
      }),
    );
  });

  describe('.computeSwapFees', function () {
    it('should return expected values', async function () {
      mockComputeSwapFees.mockResolvedValue([toBN(1), toBN(2)]);

      const swap = await Swap.create({
        network: net,
        marketAddress,
        amount: powOf(1, 18).toString(),
        provider: provider,
        taker: taker,
        lid: 1,
        price: powOf(1, 18).toString(),
      });

      const result = await handler.computeSwapFees(swap);
      expect(mockComputeSwapFees).toBeCalledTimes(1);
      expect(result).toEqual([toBN(1), toBN(2)]);
    });
  });

  describe('.onUpdatedFungibleLiquidity', () => {
    it('should create new liquidity if none exist and deduction=false', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseType: AssetType.ERC20,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteType: AssetType.SYNTH,
        quoteAddress: quoteAddress,
      });
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          false,
          true,
          toBN(1),
          toBN(100),
          toBN(300),
          [toBN(1)],
          [toBN(2)],
          toBN(1),
          toBN(20),
          toBN(10),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.lid).toEqual(1);
      expect(liq.base).toEqual(market.base);
      expect(liq.baseAddress).toEqual(market.baseAddress);
      expect(liq.quote).toEqual(market.quote);
      expect(liq.quoteAddress).toEqual(market.quoteAddress);
      expect(liq.provider).toEqual(provider);
      expect(liq.target).toEqual(constants.AddressZero);
      expect(liq.paused).toEqual(true);
      expect(liq.amount).toEqual('100');
      expect(liq.price).toEqual('300');
      expect(liq.wantAndIds).toEqual([2]);
      expect(liq.wantOrIds).toEqual([1]);
      expect(liq.minSwap).toEqual('1');
      expect(liq.maxSwap).toEqual('20');
      expect(liq.timeToPay).toEqual(10);

      const marketPrice = await MarketPrice.find({ network: net, marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.baseAddress).toEqual(market.baseAddress);
      expect(marketPrice.quoteAddress).toEqual(market.quoteAddress);
      expect(marketPrice.provider).toEqual(provider);
      expect(marketPrice.lid).toEqual(liq.lid);
    });

    it('should update the liquidity if it already exist and deduction=false', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
      });
      const lid = 1;
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
        amount: '100',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          false,
          false,
          toBN(lid),
          toBN(10),
          toBN(430),
          [toBN(3)],
          [toBN(4)],
          toBN(2),
          toBN(20),
          toBN(10),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.amount).toEqual('110');
      expect(liq.paused).toEqual(false);
      expect(liq.price).toEqual('430');
      expect(liq.wantOrIds).toEqual([3]);
      expect(liq.wantAndIds).toEqual([4]);
      expect(liq.minSwap).toEqual('2');
      expect(liq.maxSwap).toEqual('20');
      expect(liq.timeToPay).toEqual(10);
    });

    it('should update the liquidity if it already exist and deduction=true', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
      });
      const lid = 1;
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
        amount: '100',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          true,
          false,
          toBN(lid),
          toBN(10),
          toBN(430),
          [toBN(3)],
          [toBN(4)],
          toBN(2),
          toBN(20),
          toBN(10),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.amount).toEqual('90');
    });

    describe('quote asset type is NFT', () => {
      it('should not create market price', async () => {
        const market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseType: AssetType.SYNTH,
          baseAddress: baseAddress,
          quote: QUOTE,
          quoteAddress: quoteAddress,
          quoteType: AssetType.ERC721,
        });
        const lid = 1;
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: provider,
          amount: '100',
          wantOrIds: [1],
          wantAndIds: [2],
          lid: lid,
        });
        await expect(
          handler.onUpdatedFungibleLiquidity(
            provider,
            marketAddress,
            constants.AddressZero,
            true,
            false,
            toBN(lid),
            toBN(10),
            toBN(430),
            [toBN(3)],
            [toBN(4)],
            toBN(2),
            toBN(20),
            toBN(10),
            undefined,
          ),
        ).resolves.toBeUndefined();
        const marketPrice = await MarketPrice.find({ network: net, marketAddress });
        expect(marketPrice).toBeUndefined();
      });
    });
  });

  describe('.onUpdatedNonFungibleLiquidity', () => {
    it('should create new liquidity if none exist and deduction=false', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        baseType: AssetType.ERC721,
        quote: QUOTE,
        quoteAddress: quoteAddress,
        quoteType: AssetType.ERC20,
      });
      await expect(
        handler.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          false,
          true,
          toBN(1),
          [toBN(1)],
          toBN(300),
          [toBN(1)],
          [toBN(2)],
          toBN(1),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.base).toEqual(market.base);
      expect(liq.baseAddress).toEqual(market.baseAddress);
      expect(liq.quote).toEqual(market.quote);
      expect(liq.quoteAddress).toEqual(market.quoteAddress);
      expect(liq.provider).toEqual(provider);
      expect(liq.target).toEqual(constants.AddressZero);
      expect(liq.paused).toEqual(true);
      expect(liq.ids).toEqual([1]);
      expect(liq.price).toEqual('300');
      expect(liq.wantAndIds).toEqual([2]);
      expect(liq.wantOrIds).toEqual([1]);
      expect(liq.minSwap).toEqual(null);
      expect(liq.maxSwap).toEqual(null);
      expect(liq.timeToPay).toEqual(1);

      const marketPrice = await MarketPrice.find({ network: net, marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.baseAddress).toEqual(market.baseAddress);
      expect(marketPrice.quoteAddress).toEqual(market.quoteAddress);
      expect(marketPrice.provider).toEqual(provider);
      expect(marketPrice.lid).toEqual(liq.lid);
    });

    it('should update the liquidity if it already exist and deduction=false', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
      });
      const lid = 1;
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
        amount: '100',
        ids: [1],
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });
      await expect(
        handler.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          false,
          false,
          toBN(lid),
          [toBN(2)],
          toBN(10),
          [toBN(3)],
          [toBN(4)],
          toBN(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.amount).toEqual('100');
      expect(liq.paused).toEqual(false);
      expect(liq.price).toEqual('10');
      expect(liq.ids).toEqual([1, 2]);
      expect(liq.wantOrIds).toEqual([3]);
      expect(liq.wantAndIds).toEqual([4]);
      expect(liq.minSwap).toEqual(null);
      expect(liq.maxSwap).toEqual(null);
      expect(liq.timeToPay).toEqual(2);
    });

    it('should update the liquidity if it already exist and deduction=true', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
      });
      const lid = 1;
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
        amount: '100',
        ids: [1, 2],
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });
      await expect(
        handler.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          constants.AddressZero,
          true,
          false,
          toBN(lid),
          [toBN(2), toBN(3)],
          toBN(10),
          [toBN(3)],
          [toBN(4)],
          toBN(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.ids).toEqual([1]);
    });

    describe('quote is NFT', () => {
      it('should update the liquidity if it already exist and deduction=true', async () => {
        await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress: baseAddress,
          baseType: AssetType.ERC721,
          quote: QUOTE,
          quoteAddress: quoteAddress,
          quoteType: AssetType.ERC721,
        });
        await expect(
          handler.onUpdatedNonFungibleLiquidity(
            provider,
            marketAddress,
            constants.AddressZero,
            false,
            true,
            toBN(1),
            [toBN(1)],
            toBN(300),
            [toBN(1)],
            [toBN(2)],
            toBN(1),
            undefined,
          ),
        ).resolves.toBeUndefined();
        const marketPrice = await MarketPrice.find({ network: net, marketAddress });
        expect(marketPrice).toBeUndefined();
      });
    });
  });

  describe('.onUpdatedPrice', () => {
    it('should return error when liquidity was not found locally', async () => {
      await expect(handler.onUpdatedPrice('0xMarket', taker, manager, toBN(0), toBN(100), {} as any)).rejects.toEqual(
        new Error('liquidity not found'),
      );
    });

    it('should update liquidity price and add a new market price entry', async () => {
      let liq = await Liquidity.create({
        network: net,
        lid: 0,
        marketAddress,
        provider: taker,
        amount: '10000',
        price: '200',
      });
      await expect(
        handler.onUpdatedPrice(marketAddress, taker, manager, toBN(liq.lid), toBN(100), {} as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.find({ id: liq.id });
      expect(liq.price).toEqual('100');

      const marketPrice = await MarketPrice.find({ marketAddress: liq.marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.price).toEqual('100');
      expect(marketPrice.provider).toEqual(liq.provider);
    });
  });

  describe('.onUpdatedLiquidityManager', () => {
    it('should update manager of all liquidity belonging to the provider in the target market', async () => {
      await Liquidity.create({ network: net, provider, marketAddress, lid: 0 });
      await Liquidity.create({ network: net, provider, marketAddress, lid: 1 });

      await expect(
        handler.onUpdatedLiquidityManager(marketAddress, provider, manager, {} as any),
      ).resolves.toBeUndefined();

      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
      const liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq.manager).toEqual(manager);
      expect(liq2.manager).toEqual(manager);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewLiquidityManager, net, manager, {
        marketAddress,
        provider,
      });
    });
  });

  describe('.onRemoveLiquidityManager', () => {
    it('should clear manager address', async () => {
      await Liquidity.create({ network: net, provider, marketAddress, lid: 0 });
      await Liquidity.create({ network: net, provider, marketAddress, lid: 1 });

      await expect(handler.onRemoveLiquidityManager(marketAddress, taker, manager, {} as any)).resolves.toBeUndefined();

      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
      const liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq.manager).toEqual(null);
      expect(liq2.manager).toEqual(null);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.RemoveLiquidityManager, net, manager, {
        marketAddress,
        provider: taker,
      });
    });
  });

  describe('.onProtocolFeeUpdated', () => {
    it('should update correctly', async () => {
      await handler.onProtocolFeeUpdated(toBN(10), toBN(2), toBN(12), toBN(1), toBN(2), toBN(3), {} as any);
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.InstantSwapFeeBp))).value).toEqual('10');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.SynthSwapFeeBp))).value).toEqual('2');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.StableSwapFeeBp))).value).toEqual('12');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.FixedSynthSwapFee))).value).toEqual('1');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.FixedNFTSwapFee))).value).toEqual('2');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.InstantNFTSwapFeeBp))).value).toEqual('3');
    });
  });

  describe('.onSwapOrder', () => {
    it('should create swap correctly and send notification to liquidity provider', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
      });

      const lid = toBN(0);
      const liqAmt = powOf(200, 18);
      await Liquidity.create({
        network: net,
        marketAddress: marketAddress,
        provider: provider,
        lid: lid.toNumber(),
        amount: liqAmt.toString(),
        totalSwaps: 1,
      });

      mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

      const numTypeInfo = [toBN(2), lid, toBN(100), toBN(1), toBN(1), toBN(1)];
      const [orderId, , amount, , , operator] = numTypeInfo;
      await handler.onSwapOrder(
        marketAddress,
        provider,
        taker,
        constants.AddressZero,
        numTypeInfo,
        [toBN(1)],
        [toBN(2)],
        { transactionHash: '0xTxHash' } as any,
      );

      const swap = await Swap.getByOrderId(orderId.toNumber());
      expect(swap).toBeDefined();
      expect(swap.marketAddress).toEqual(market.address);
      expect(swap.lid).toEqual(lid.toNumber());
      expect(swap.provider).toEqual(provider);
      expect(swap.taker).toEqual(taker);
      expect(swap.base).toEqual(market.base);
      expect(swap.baseAddress).toEqual(market.baseAddress);
      expect(swap.quote).toEqual(market.quote);
      expect(swap.quoteAddress).toEqual(market.quoteAddress);
      expect(swap.orderId).toEqual(2);
      expect(swap.amount).toEqual('100');
      expect(swap.price).toEqual('1');
      expect(swap.offerId).toEqual(1);
      expect(swap.providerIds).toEqual([1]);
      expect(swap.takerIds).toEqual([2]);
      expect(swap.operator).toEqual(operator.toNumber());
      expect(swap.protocolFee).toEqual('2');
      expect(swap.marketCreatorFee).toEqual('3');

      const liq = await Liquidity.getLiquidity(net, marketAddress, provider, lid.toNumber());
      expect(liq.openOrders).toEqual(1);
      expect(liq.amount).toEqual(liqAmt.sub(amount).toString());
      expect(liq.totalSwaps).toEqual(2);

      const mar = await Market.getById(market.id);
      expect(mar.totalSwaps).toEqual(1);

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewInteractiveSwap, net, provider, {
        marketAddress,
        provider,
        swapper: taker,
        swap,
        market,
      });
    });
  });

  describe('.onSwap', () => {
    describe('when orderId is unset (instant swap)', () => {
      it('should create instant swap correctly and send notification to' + ' liquidity provider', async () => {
        let market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          quote: QUOTE,
          amountSwapped: powOf(1, 18).toString(),
          totalSwaps: 1,
        });

        const lid = toBN(0);
        let liq = await Liquidity.create({
          network: net,
          marketAddress,
          provider: provider,
          lid: lid.toNumber(),
          price: powOf(1, 18).toString(),
          amount: powOf(1000, 18).toString(),
          amountSwapped: powOf(10, 18).toString(),
        });

        mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

        const numTypeInfo = [toBN(0), lid, toBN('1000000000000000000'), toBN(1), toBN(1), toBN(1)];
        const [, , amount, price, offerId, operator] = numTypeInfo;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          constants.AddressZero,
          numTypeInfo,
          false,
          [toBN(1), toBN(2)],
          [toBN(3), toBN(4)],
          { transactionHash: txHash } as any,
        );

        const swap = await Swap.find({ network: net, marketAddress: market.address, lid: liq.lid });
        expect(swap).toBeDefined();
        expect(swap.provider).toEqual(provider);
        expect(swap.taker).toEqual(taker);
        expect(swap.base).toEqual(market.base);
        expect(swap.baseAddress).toEqual(market.baseAddress);
        expect(swap.quote).toEqual(market.quote);
        expect(swap.quoteAddress).toEqual(market.quoteAddress);
        expect(swap.orderId).toEqual(null);
        expect(swap.amount).toEqual(amount.toString());
        expect(swap.price).toEqual(price.toString());
        expect(swap.instant).toBeTruthy();
        expect(swap.paid).toBeTruthy();
        expect(swap.released).toBeTruthy();
        expect(swap.offerId).toEqual(offerId.toNumber());
        expect(swap.operator).toEqual(operator.toNumber());
        expect(swap.providerIds).toEqual([1, 2]);
        expect(swap.takerIds).toEqual([3, 4]);
        expect(swap.protocolFee).toEqual('2');
        expect(swap.marketCreatorFee).toEqual('3');
        expect(swap.txHash).toEqual(txHash);

        liq = await Liquidity.getById(liq.id);
        expect(liq.amount).toEqual('999000000000000000000');
        expect(liq.lastSwapAt).toBeDefined();
        expect(liq.amountSwapped).toEqual('11000000000000000000');
        expect(liq.totalSwaps).toEqual(1);

        market = await Market.getById(market.id);
        expect(market.lastSwapAt).toBeDefined();
        expect(market.amountSwapped).toEqual('2000000000000000000');
        expect(market.totalSwaps).toEqual(2);

        expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewInstantSwap, net, provider, {
          market,
          swap,
          liq,
        });
      });
    });

    describe('when orderId is set', () => {
      it('should create swap, mark it as released and send notification to taker', async () => {
        let market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseType: AssetType.ERC20,
          quote: QUOTE,
          quoteType: AssetType.SYNTH,
          amountSwapped: powOf(1, 18).toString(),
          totalSwaps: 1,
        });

        let liq = await Liquidity.create({
          network: net,
          marketAddress,
          provider: provider,
          lid: 0,
          price: powOf(1, 18).toString(),
          amount: powOf(1000, 18).toString(),
          amountSwapped: powOf(10, 18).toString(),
          totalSwaps: 1,
          openOrders: 2,
        });

        const orderId = toBN(1);
        let swap = await Swap.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          amount: powOf(10, 18).toString(),
          provider,
          taker,
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

        mockGetOrder.mockResolvedValue({ finalizer: userAddr });

        const numTypeInfo = [orderId, toBN(liq.lid), toBN(swap.amount), toBN(liq.price), toBN(1), toBN(1)];
        const [, , amount, , ,] = numTypeInfo;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          constants.AddressZero,
          numTypeInfo,
          true,
          [toBN(1), toBN(2)],
          [toBN(3), toBN(4)],
          { transactionHash: txHash } as any,
        );

        swap = await Swap.find({ marketAddress: market.address });
        expect(swap).toBeDefined();
        expect(swap.marketAddress).toEqual(market.address);
        expect(swap.instant).toBeFalsy();
        expect(swap.released).toBeTruthy();
        expect(swap.finalizer).toEqual(userAddr);

        const liqUpd = await Liquidity.getLiquidity(net, marketAddress, provider);
        expect(liqUpd.openOrders).toEqual(1);
        expect(liqUpd.lastSwapAt).toBeDefined();
        expect(liqUpd.amountSwapped).toEqual(toBN(liq.amountSwapped).add(amount).toString());
        expect(liqUpd.totalSwaps).toEqual(1);

        // should not update completion rate since swap was disputed
        expect(liq.completionRate).toEqual(0);

        const marketUpd = await Market.getById(market.id);
        expect(marketUpd.lastSwapAt).toBeDefined();
        expect(marketUpd.amountSwapped).toEqual(toBN(market.amountSwapped).add(amount).toString());
        expect(marketUpd.totalSwaps).toEqual(market.totalSwaps);

        // should not update completion rate since swap was disputed
        expect(market.completionRate).toEqual(0);

        // mark recent dispute as released
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.orderReleased).toBeTruthy();

        liq = await Liquidity.getById(liq.id);
        market = await Market.getById(market.id);
        swap.market = market;

        expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderReleased, net, taker, {
          marketAddress,
          market,
          liq,
          swap,
          byDispute: true,
        });
      });
    });
  });

  describe('.onOrderCancelled', () => {
    it('should mark order as cancelled and send notification to counterparty', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        quote: QUOTE,
      });

      const lid = 0;
      let liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider: provider,
        lid,
        openOrders: 1,
        amount: powOf(990, 18).toString(),
      });

      const orderId = toBN(1);
      const amount = powOf(10, 18);
      let swap = await Swap.create({
        network: net,
        marketAddress: market.address,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        provider: provider,
        taker: taker,
        lid,
      });

      const byDispute = false;
      await handler.onOrderCancelled(orderId, taker, byDispute, {} as any);

      // Swap should be marked as cancelled
      swap = await Swap.getById(swap.id);
      expect(swap).toBeDefined();
      expect(swap.cancelled).toBeTruthy();
      expect(swap.byDispute).toBeFalsy();

      // decrement open orders by 1 and add swap amount back to liquidity amount
      liq = await Liquidity.getById(liq.id);
      expect(liq.openOrders).toEqual(0);
      expect(liq.amount).toEqual(powOf(1000, 18).toString());

      // Should send notification to counterparty
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, provider, {
        market,
        liq,
        swap,
        byDispute,
      });

      // When provider is the canceller
      await handler.onOrderCancelled(orderId, provider, byDispute, {} as any);
      swap = await Swap.getById(swap.id);
      liq = await Liquidity.getById(liq.id);

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, taker, {
        market,
        liq,
        swap,
        byDispute,
      });
    });
  });

  describe('.onSwapOrderPaid', () => {
    it('should mark order as paid and send notification to counterparty', async () => {
      let market = await Market.create({
        network: net,
        address: marketAddress,
        base: 'BASE',
        quote: 'QUOTE',
        baseType: AssetType.ERC20,
        quoteType: AssetType.SYNTH,
      });

      const orderId = toBN(1);
      const amount = powOf(10, 18);
      await Swap.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        provider,
        taker,
      });

      await handler.onSwapOrderPaid(orderId, {} as any);

      // Make sure swap is marked as paid
      let swap = await Swap.find({ marketAddress: market.address });
      expect(swap).toBeDefined();
      expect(swap.paid).toBeTruthy();

      swap.market = market;
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderPaid, net, provider, {
        swap,
        market,
      });

      // Should send notification to taker when base is SYNTH and quote ERC20
      market = await Market.updateById(market.id, { baseType: AssetType.SYNTH, quoteType: AssetType.ERC20 });
      await handler.onSwapOrderPaid(orderId, {} as any);
      swap = await Swap.find({ marketAddress: market.address });
      swap.market = market;
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderPaid, net, taker, {
        swap,
        market,
      });
    });
  });

  describe('.onTogglePause', () => {
    it('should update liquidity `paused` state', async () => {
      const lid = 0;
      let liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid,
        paused: false,
      });
      await expect(handler.onTogglePause(marketAddress, provider, toBN(lid), true, {} as any)).resolves.toBeUndefined();
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

  describe('.onProtocolFeeSplitUpdated', function () {
    it('should save correct meta values', async () => {
      await expect(handler.onProtocolFeeSplitUpdated(toBN(1), toBN(2), toBN(3), {} as any)).resolves.toBeUndefined();
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Inventor))).toHaveProperty('value', '1');
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Shared))).toHaveProperty('value', '2');
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Operator))).toHaveProperty('value', '3');
    });
  });

  describe('.onNFTDiscountUpdated', function () {
    it('should save correct meta value', async () => {
      await expect(handler.onNFTDiscountUpdated(toBN(1), {} as any)).resolves.toBeUndefined();
      expect(await Meta.getContractParam(net, 'nftDiscountBP')).toEqual('1');
    });
  });

  describe('.onNewOffer', function () {
    it('should throw error if offer does not exist on-chain', async () => {
      mockGetOffer.mockResolvedValue(undefined);
      await expect(
        handler.onNewOffer(marketAddress, provider, toBN(0), taker, toBN(0), {} as any),
      ).rejects.toThrowError('on-chain offer not found');
    });

    it('should create new offer in database', async () => {
      const now = moment();
      const onchainOffer = {
        amount: powOf(10, 18),
        price: powOf(1, 18),
        ids: [toBN(1), toBN(2)],
        deadline: toBN(now.unix()),
      };
      mockGetOffer.mockResolvedValue(onchainOffer);

      const offerId = toBN(1);
      const lid = toBN(0);
      await expect(
        handler.onNewOffer(marketAddress, provider, lid, taker, offerId, {} as any),
      ).resolves.toBeUndefined();

      const offer = await Offer.getByOfferId(offerId.sub(1).toNumber());
      expect(offer.network).toEqual(net);
      expect(offer.marketAddress).toEqual(marketAddress);
      expect(offer.provider).toEqual(provider);
      expect(offer.lid).toEqual(lid.toNumber());
      expect(offer.creator).toEqual(taker);
      expect(offer.amount).toEqual(onchainOffer.amount.toString());
      expect(offer.price).toEqual(onchainOffer.price.toString());
      expect(offer.ids).toEqual(onchainOffer.ids.map((id) => id.toNumber()));
      expect(moment(offer.deadline).toISOString()).toEqual(moment.unix(now.unix()).toISOString());

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewOffer, net, provider, {
        offer,
      });
    });
  });

  describe('.onOfferUpdated', function () {
    it('should update offer correctly', async () => {
      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
      });

      const deadline = moment().add(1, 'day').unix();
      await expect(
        handler.onOfferUpdated(toBN(1), userAddr, toBN(2), toBN(3), [toBN(4)], toBN(deadline), {} as any),
      ).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.amount).toEqual('2');
      expect(offer.price).toEqual('3');
      expect(offer.ids).toEqual([4]);
      expect(moment(offer.deadline).toISOString()).toEqual(moment.unix(deadline).toISOString());

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferUpdated, net, provider, {
        offer,
      });
    });
  });

  describe('.onOfferAccepted', function () {
    it('should update offer correctly', async () => {
      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
        creator: userAddr,
      });

      const execAt = moment().add(1, 'day').unix();
      await expect(handler.onOfferAccepted(toBN(1), provider, execAt, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.accepted).toBeTruthy();
      expect(moment(offer.execAt).toISOString()).toEqual(moment.unix(execAt).toISOString());

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferAccepted, net, userAddr, {
        offer,
      });
    });
  });

  describe('.onOfferCancelled', function () {
    it('should update offer correctly', async () => {
      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
        creator: userAddr,
      });

      await expect(handler.onOfferCancelled(toBN(1), userAddr, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.cancelled).toBeTruthy();

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferCancelled, net, provider, {
        offer,
      });
    });
  });

  describe('.onOfferUnaccepted', function () {
    it('should update offer correctly', async () => {
      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
        creator: userAddr,
        accepted: true,
        execAt: moment().toISOString(),
      });

      await expect(handler.onOfferUnaccepted(toBN(1), userAddr, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.accepted).toBeFalsy();
      expect(offer.execAt).toBeNull();

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferUnaccepted, net, userAddr, {
        offer,
      });
    });
  });

  describe('.onOfferExecuted', function () {
    it('should update offer correctly', async () => {
      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
        creator: userAddr,
      });

      await expect(handler.onOfferExecuted(toBN(1), userAddr, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.executed).toBeTruthy();

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferExecuted, net, provider, {
        offer,
      });
    });
  });

  describe('.onUpdatedLiquiditySwapBadges', function () {
    it("should update liquidity provider's badges", async () => {
      const lid = toBN(0);
      await expect(
        handler.onUpdatedLiquiditySwapBadges(
          marketAddress,
          provider,
          lid,
          [
            ['badge1', 'path1'],
            ['badge2', 'path2'],
          ],
          {} as any,
        ),
      ).resolves.toBeUndefined();
      let badges = await MarketBadge.findAll({ marketAddress, provider, lid: lid.toNumber() });
      expect(badges).toHaveLength(2);
      expect(badges[0].badge).toEqual('badge1');
      expect(badges[0].path).toEqual('path1');
      expect(badges[1].badge).toEqual('badge2');
      expect(badges[1].path).toEqual('path2');

      // Update again
      await expect(
        handler.onUpdatedLiquiditySwapBadges(
          marketAddress,
          provider,
          lid,
          [
            ['badge3', 'path3'],
            ['badge4', 'path4'],
          ],
          {} as any,
        ),
      ).resolves.toBeUndefined();
      badges = await MarketBadge.findAll({ marketAddress, provider, lid: lid.toNumber() });
      expect(badges).toHaveLength(2);
      expect(badges[0].badge).toEqual('badge3');
      expect(badges[0].path).toEqual('path3');
      expect(badges[1].badge).toEqual('badge4');
      expect(badges[1].path).toEqual('path4');
    });
  });

  describe('.onParameterUpdate', function () {
    it('should throw error if contract params metadata has not been initialized', async () => {
      const key = Meta.makeNetKey(net, MetaKeys.ContractsParams);
      await Meta.update(key, '');
      await expect(handler.onParameterUpdate('appealDur', '1', {} as any)).rejects.toThrow(
        'Contracts params not initialized',
      );
    });

    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('appealDur', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'appealDur');
      expect(value).toEqual('1');
    });
  });
});

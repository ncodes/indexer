import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CoreHandler } from './core.handler';
import { constants } from 'ethers';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import { powOf, toBN } from '../common';
import MarketPrice from '../../models/market_price';
import { NotificationID } from '../../jobs/mailer/NotifierService';
import Meta, { FeeName, MetaKeys, ProtocolFeeBeneficiary } from '../../models/meta';
import Swap from '../../models/swap';
import Dispute from '../../models/dispute';
import * as moment from 'moment';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Offer from '../../models/offers';

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
  const releaser = '0xReleaser';
  const canceller = '0xCanceller';
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
      let market = await Market.create({
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

      market = await Market.getById(market.id);
      expect(market.totalLiquidity).toEqual('100');

      const marketPrice = await MarketPrice.find({ network: net, marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.baseAddress).toEqual(market.baseAddress);
      expect(marketPrice.quoteAddress).toEqual(market.quoteAddress);
      expect(marketPrice.provider).toEqual(provider);
      expect(marketPrice.lid).toEqual(liq.lid);
    });

    it('should update the liquidity if it already exist and deduction=false', async () => {
      let market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
        totalLiquidity: '100',
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

      market = await Market.getById(market.id);
      expect(market.totalLiquidity).toEqual('110');
    });

    it('should update the liquidity if it already exist and deduction=true', async () => {
      let market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
        totalLiquidity: '100',
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

      market = await Market.getById(market.id);
      expect(market.totalLiquidity).toEqual('90');
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
    let market: Market;
    let liq: Liquidity;
    let liq2: Liquidity;
    beforeEach(async () => {
      market = await Market.create({ network: net, address: marketAddress, base: BASE, quote: QUOTE });
      liq = await Liquidity.create({ network: net, provider, marketAddress, lid: 0 });
      liq2 = await Liquidity.create({ network: net, provider, marketAddress, lid: 1 });
    });

    it('should update manager of all liquidity belonging to the provider in the target market', async () => {
      await expect(
        handler.onUpdatedLiquidityManager(marketAddress, provider, manager, constants.AddressZero, {} as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
      liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq.manager).toEqual(manager);
      expect(liq2.manager).toEqual(manager);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.UpdatedLiquidityManager, net, manager, {
        market,
        provider,
      });
    });

    describe('when old manager is the same as the new manager', () => {
      it('should not update liquidity or send notification', async () => {
        await expect(
          handler.onUpdatedLiquidityManager(marketAddress, provider, manager, manager, {} as any),
        ).resolves.toBeUndefined();
        liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
        liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
        expect(liq.manager).toBeNull();
        expect(liq2.manager).toBeNull();
        expect(mockNotify).not.toBeCalled();
      });
    });

    describe('when old manager is not the same as the new manager', () => {
      it('should send notification to old and new manager', async () => {
        await expect(
          handler.onUpdatedLiquidityManager(marketAddress, provider, manager, userAddr, {} as any),
        ).resolves.toBeUndefined();

        const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
        const liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
        expect(liq.manager).toEqual(manager);
        expect(liq2.manager).toEqual(manager);

        // expect notifications to have been sent
        const notifData = { market, provider };
        expect(mockNotify).toBeCalledTimes(2);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.RemoveLiquidityManager, net, userAddr, notifData);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.UpdatedLiquidityManager, net, manager, notifData);
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
    const lid = toBN(0);
    const liqAmt = powOf(200, 18);
    let market: Market;
    let liq: Liquidity;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteAddress: quoteAddress,
        totalLiquidity: liqAmt.toString(),
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress: marketAddress,
        provider: provider,
        lid: lid.toNumber(),
        amount: liqAmt.toString(),
        totalSwaps: 1,
      });
    });

    it('should create swap correctly and send notification to liquidity provider', async () => {
      mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });
      const cancelAt = moment().add(1, 'day');
      const numTypeInfo = [toBN(2), lid, toBN(100), toBN(1), toBN(1), toBN(1), toBN(cancelAt.unix())];
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
      expect(moment(swap.cancelAt).unix()).toEqual(cancelAt.unix());

      const liq = await Liquidity.getLiquidity(net, marketAddress, provider, lid.toNumber());
      expect(liq.openOrders).toEqual(1);
      expect(liq.amount).toEqual(liqAmt.sub(amount).toString());
      expect(liq.totalSwaps).toEqual(2);

      market = await Market.getById(market.id);
      expect(market.totalSwaps).toEqual(1);
      expect(market.totalLiquidity).toEqual(liqAmt.sub(amount).toString());
      swap.market = market;

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewInteractiveSwap, net, provider, {
        marketAddress,
        provider,
        swapper: taker,
        swap,
        market,
      });
    });

    describe('quote asset is NFT', function () {
      it('should set swap amount to liquidity amount', async () => {
        await Market.updateById(market.id, { quoteType: AssetType.ERC721 });
        mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });
        const cancelAt = moment().add(1, 'day');
        const numTypeInfo = [toBN(2), lid, toBN(100), toBN(1), toBN(1), toBN(1), toBN(cancelAt.unix())];
        const [orderId, , , , ,] = numTypeInfo;
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
        expect(swap.amount).toEqual(liq.amount);
      });
    });
  });

  describe('.onSwap', () => {
    const lid = toBN(0);
    let market: Market;
    let liq: Liquidity;
    const liqAmt = powOf(1000, 18);

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        quote: QUOTE,
        amountSwapped: powOf(1, 18).toString(),
        totalSwaps: 1,
        totalLiquidity: liqAmt.toString(),
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider: provider,
        lid: lid.toNumber(),
        price: powOf(1, 18).toString(),
        amount: liqAmt.toString(),
        amountSwapped: powOf(10, 18).toString(),
      });
    });

    describe('when orderId is unset (instant swap)', () => {
      it('should create instant swap correctly and send notification to liquidity provider', async () => {
        mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

        const numTypeInfo = [toBN(0), lid, toBN('1000000000000000000'), toBN(1), toBN(1), toBN(1)];
        const [, , amount, price, offerId, operator] = numTypeInfo;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          constants.AddressZero,
          releaser,
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
        expect(liq.amount).toEqual(liqAmt.sub(amount).toString());
        expect(liq.lastSwapAt).toBeDefined();
        expect(liq.amountSwapped).toEqual('11000000000000000000');
        expect(liq.totalSwaps).toEqual(1);

        market = await Market.getById(market.id);
        expect(market.lastSwapAt).toBeDefined();
        expect(market.amountSwapped).toEqual('2000000000000000000');
        expect(market.totalSwaps).toEqual(2);
        expect(market.totalLiquidity).toEqual(liqAmt.sub(amount).toString());

        expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewInstantSwap, net, provider, {
          market,
          swap,
          liq,
        });
      });

      describe('when quote is NFT', () => {
        it('should set swap amount to liquidity amount', async () => {
          await Market.updateById(market.id, { quoteType: AssetType.ERC721 });
          mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });
          const numTypeInfo = [toBN(0), lid, toBN('1000000000000000000'), toBN(1), toBN(1), toBN(1)];
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            constants.AddressZero,
            releaser,
            numTypeInfo,
            false,
            [toBN(1), toBN(2)],
            [toBN(3), toBN(4)],
            { transactionHash: txHash } as any,
          );
          const swap = await Swap.find({ network: net, marketAddress: market.address, lid: liq.lid });
          expect(swap.amount).toEqual(liq.amount);
        });
      });
    });

    describe('when orderId is set (interactive swap)', () => {
      let swap: Swap;
      let dispute: Dispute;
      const orderId = toBN(1);
      let now: moment.Moment;

      beforeEach(async () => {
        now = moment();
        swap = await Swap.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          amount: powOf(10, 18).toString(),
          provider,
          lid: lid.toNumber(),
          taker,
          createdAt: now.clone().subtract('1', 'day').toISOString(),
          paidAt: now.clone().subtract('1', 'day').toISOString(),
        });

        await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          disputeId: 0,
        });

        dispute = await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber() - 1,
          disputeId: 1,
        });
      });

      it('should create swap, mark it as released and send notification to taker', async () => {
        await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
        await Liquidity.updateById(liq.id, { amount: powOf(1000, 18).toString(), totalSwaps: 1, openOrders: 2 });

        const numTypeInfo = [orderId, toBN(liq.lid), toBN(swap.amount), toBN(liq.price), toBN(1), toBN(1)];
        const [, , amount, , ,] = numTypeInfo;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          constants.AddressZero,
          provider,
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
        expect(swap.finalizer).toEqual(provider);
        expect(swap.byDispute).toBeTruthy();
        expect(swap.finalizedAt).toBeDefined();

        const liqUpd = await Liquidity.getLiquidity(net, marketAddress, provider, lid.toNumber());
        expect(liqUpd.openOrders).toEqual(1);
        expect(liqUpd.lastSwapAt).toBeDefined();
        expect(liqUpd.amountSwapped).toEqual(toBN(liq.amountSwapped).add(amount).toString());
        expect(liqUpd.totalSwaps).toEqual(1);
        expect(liqUpd.avgFinalizeDur).toBeGreaterThan(0);
        expect(liqUpd.avgReleaseDur).toBeGreaterThan(0);

        // should not update completion rate since swap was disputed
        expect(liq.completionRate).toEqual(0);

        const marketUpd = await Market.getById(market.id);
        expect(marketUpd.lastSwapAt).toBeDefined();
        expect(marketUpd.amountSwapped).toEqual(toBN(market.amountSwapped).add(amount).toString());
        expect(marketUpd.totalSwaps).toEqual(market.totalSwaps);
        expect(marketUpd.avgFinalizeDur).toBeGreaterThan(0);
        expect(marketUpd.avgReleaseDur).toBeGreaterThan(0);

        // should not update completion rate since swap was disputed
        expect(market.completionRate).toEqual(0);

        // mark recent dispute as released
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.orderReleased).toBeTruthy();

        liq = await Liquidity.getById(liq.id);
        market = await Market.getById(market.id);
        swap = await Swap.find({ marketAddress: market.address });
        swap.market = market;

        expect(mockNotify).toHaveBeenCalledTimes(1);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderReleased, net, taker, {
          market,
          liq,
          swap,
        });
      });

      describe('releaser is not the provider or the taker', () => {
        it('should send notification to both provider and taker', async () => {
          await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
          await Liquidity.updateById(liq.id, { amount: powOf(1000, 18).toString(), totalSwaps: 1, openOrders: 2 });
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            constants.AddressZero,
            releaser,
            [orderId, toBN(liq.lid), toBN(swap.amount), toBN(liq.price), toBN(1), toBN(1)],
            true,
            [toBN(1), toBN(2)],
            [toBN(3), toBN(4)],
            { transactionHash: txHash } as any,
          );

          liq = await Liquidity.getById(liq.id);
          market = await Market.getById(market.id);
          swap = await Swap.find({ marketAddress: market.address });
          swap = await Swap.find({ marketAddress: market.address });
          swap.market = market;

          const notifData = { market, liq, swap };
          expect(mockNotify).toHaveBeenCalledTimes(2);
          expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderReleased, net, provider, notifData);
          expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderReleased, net, taker, notifData);
        });
      });
    });
  });

  describe('.onOrderCancelled', () => {
    const lid = 0;
    let now: moment.Moment;
    const orderId = toBN(1);
    const amount = powOf(10, 18);
    const liqAmt = powOf(990, 18);
    let market: Market;
    let liq: Liquidity;
    let swap: Swap;

    beforeEach(async () => {
      now = moment();

      market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        quote: QUOTE,
        totalLiquidity: liqAmt.toString(),
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider: provider,
        lid,
        openOrders: 1,
        amount: liqAmt.toString(),
      });

      swap = await Swap.create({
        network: net,
        marketAddress: market.address,
        orderId: orderId.toNumber(),
        amount: amount.toString(),
        provider: provider,
        taker: taker,
        lid,
        createdAt: now.clone().subtract(1, 'day').toISOString(),
      });
    });

    it('should mark order as cancelled and send notification to counterparty', async () => {
      const byDispute = false;
      await handler.onOrderCancelled(orderId, taker, byDispute, {} as any);

      // Swap should be marked as cancelled
      swap = await Swap.getById(swap.id);
      expect(swap).toBeDefined();
      expect(swap.cancelled).toBeTruthy();
      expect(swap.byDispute).toBeFalsy();
      expect(swap.finalizer).toEqual(taker);
      expect(swap.finalizedAt).toBeDefined();

      // decrement open orders by 1 and add swap amount back to liquidity amount
      liq = await Liquidity.getById(liq.id);
      expect(liq.openOrders).toEqual(0);
      expect(liq.amount).toEqual(liqAmt.add(amount).toString());
      expect(liq.avgFinalizeDur).toBeGreaterThan(0);

      market = await Market.getById(market.id);
      expect(market.totalLiquidity).toEqual(liqAmt.add(amount).toString());
      expect(market.avgFinalizeDur).toBeGreaterThan(0);

      // Should send notification to counterparty
      let notifData = { market, liq, swap };
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, provider, notifData);
      mockNotify.mockClear();

      // When provider is the canceller
      await handler.onOrderCancelled(orderId, provider, byDispute, {} as any);
      market = await Market.getById(market.id);
      swap = await Swap.getById(swap.id);
      liq = await Liquidity.getById(liq.id);

      notifData = { market, liq, swap };
      expect(mockNotify).toBeCalledTimes(1);
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, taker, notifData);
    });

    describe('when neither provider or taker are the canceller', () => {
      it('should send notification to both provider and taker', async () => {
        await handler.onOrderCancelled(orderId, canceller, false, {} as any);

        // Swap should be marked as cancelled
        market = await Market.getById(market.id);
        swap = await Swap.getById(swap.id);
        swap.market = market;
        liq = await Liquidity.getById(liq.id);

        // Should send notification to counterparty
        const notifData = { market, liq, swap };
        expect(mockNotify).toHaveBeenCalledTimes(2);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, provider, notifData);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, taker, notifData);
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

      let liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      const orderId = toBN(1);
      const amount = powOf(10, 18);
      await Swap.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        lid: liq.lid,
        amount: amount.toString(),
        provider,
        taker,
      });

      const disputeFrom = moment().unix();
      await handler.onSwapOrderPaid(orderId, toBN(disputeFrom), {} as any);

      // Make sure swap is marked as paid
      let swap = await Swap.find({ marketAddress: market.address });
      expect(swap).toBeDefined();
      expect(swap.paid).toBeTruthy();
      expect(swap.payer).toEqual(taker);
      expect(swap.paidAt).toBeDefined();
      expect(moment(swap.disputeFrom).unix()).toEqual(disputeFrom);

      liq = await Liquidity.getById(liq.id);
      expect(liq.avgPaymentDur).toBeGreaterThan(0);

      market = await Market.getById(market.id);
      expect(market.avgPaymentDur).toBeGreaterThan(0);

      swap.market = market;
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderPaid, net, provider, {
        swap,
        market,
      });

      // Should send notification to taker when base is SYNTH and quote ERC20
      market = await Market.updateById(market.id, { baseType: AssetType.SYNTH, quoteType: AssetType.ERC20 });
      await handler.onSwapOrderPaid(orderId, toBN(disputeFrom), {} as any);
      swap = await Swap.find({ marketAddress: market.address });
      market = await Market.getById(market.id);
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
      const convToken = '0xConvToken';
      const convAmount = toBN(100);
      const amount = toBN(10);
      const now = moment().unix();
      await expect(
        handler.onTransferredToFeePool(token, amount, convToken, convAmount, {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      const mineTasks = await MineTask.findAll({ type: MineTaskType.FeeTransfer, token });
      expect(mineTasks).toHaveLength(1);
      expect(moment(mineTasks[0].mineAt).isAfter(moment.unix(now))).toBeTruthy();
      expect(mineTasks[0].token).toEqual(token);
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
    it('should create new offer in database', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        manager: userAddr,
      });

      const lid = toBN(0);
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        lid: lid.toNumber(),
        provider,
      });

      const now = moment();
      const offerId = toBN(1);
      const amount = powOf(10, 18);
      const price = powOf(1, 18);
      const ids = [toBN(1), toBN(2)];
      const deadline = toBN(now.unix());
      await expect(
        handler.onNewOffer(marketAddress, provider, lid, taker, offerId, amount, price, ids, deadline, {} as any),
      ).resolves.toBeUndefined();

      const offer = await Offer.getByOfferId(offerId.sub(1).toNumber());
      expect(offer.network).toEqual(net);
      expect(offer.marketAddress).toEqual(marketAddress);
      expect(offer.provider).toEqual(provider);
      expect(offer.lid).toEqual(lid.toNumber());
      expect(offer.creator).toEqual(taker);
      expect(offer.amount).toEqual(amount.toString());
      expect(offer.price).toEqual(price.toString());
      expect(offer.ids).toEqual(ids.map((id) => id.toNumber()));
      expect(moment(offer.deadline).toISOString()).toEqual(moment.unix(deadline.toNumber()).toISOString());

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewOffer, net, provider, {
        offer,
        market,
        liq,
      });
    });
  });

  describe('.onOfferUpdated', function () {
    it('should update offer correctly', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
      });

      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        lid: liq.lid,
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
        updated: true,
        offer,
        market,
        liq,
      });
    });
  });

  describe('.onOfferAccepted', function () {
    it('should update offer correctly', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
      });

      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        lid: liq.lid,
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
        liq,
        market,
      });
    });
  });

  describe('.onOfferCancelled', function () {
    it('should update offer correctly', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
      });

      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        lid: liq.lid,
        provider,
        creator: userAddr,
      });

      await expect(handler.onOfferCancelled(toBN(1), userAddr, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.cancelled).toBeTruthy();

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferCancelled, net, provider, {
        offer,
        liq,
        market,
      });
    });
  });

  describe('.onOfferUnaccepted', function () {
    it('should update offer correctly', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
      });

      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        provider,
        lid: liq.lid,
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
        liq,
        market,
      });
    });
  });

  describe('.onOfferExecuted', function () {
    it('should update offer correctly', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
      });

      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: 0,
      });

      let offer = await Offer.create({
        network: net,
        marketAddress,
        offerId: 1,
        lid: liq.lid,
        provider,
        creator: userAddr,
      });

      await expect(handler.onOfferExecuted(toBN(1), userAddr, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.executed).toBeTruthy();

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferExecuted, net, provider, {
        offer,
        market,
        liq,
      });
    });
  });

  describe('.onUpdatedLiquiditySwapBadges', function () {
    it("should update liquidity provider's badges", async () => {
      const lid = toBN(0);
      let liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: lid.toNumber(),
      });

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

      liq = await Liquidity.getById(liq.id);
      expect(liq.requiredSwapBadges).toEqual(['badge1/path1', 'badge2/path2']);

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
      liq = await Liquidity.getById(liq.id);
      expect(liq.requiredSwapBadges).toEqual(['badge3/path3', 'badge4/path4']);
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

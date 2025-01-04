import { Wallet, ZeroAddress } from 'ethers';
import * as moment from 'moment';
import { randStr, toDec } from '../../common/common';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/notifications/common';
import Dispute from '../../models/dispute';
import Event, { Events } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import MarketPrice from '../../models/market_price';
import Meta, { FeeName, MetaKeys, ProtocolFeeBeneficiary } from '../../models/meta';
import MineTask from '../../models/mine_task';
import Offer from '../../models/offer';
import Swap from '../../models/swap';
import User from '../../models/user';
import { pow10, powOf, toBigInt, toNumber } from '../common';
import { MineTaskType } from './../../models/mine_task';
import { CoreHandler } from './core.handler';

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

const mockTryToUsd = jest.fn();
const MockMetadataService = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

// mock exchange rate service and the get method
const mockGet = jest.fn();
const MockExchangeRateService = jest.fn().mockImplementation(() => {
  return {
    get: mockGet,
  };
});

const mockComputeSwapFees = jest.fn();

const mockGetDisputeDelayDur = jest.fn();

const mockGetCfg = jest.fn();
const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    cfgSrv: {
      get: mockGetCfg,
    },
  };
});

describe('CoreHandler', () => {
  const taker = '0xTaker';
  const provider = Wallet.createRandom().address;
  const marketAddress = Wallet.createRandom().address;
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
  const contracts = { core: coreContract };
  let cfg: Record<string, string> = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    cfg = {
      'app.defaultDisputeDelayDur': '1000',
    };

    mockGetCfg.mockImplementation((key: string) => {
      return cfg[key];
    });

    handler = new CoreHandler(
      new MockNetworkService(),
      new MockNotifierService(),
      new MockMetadataService(),
      new MockExchangeRateService(),
      null,
      net,
      contracts,
    );
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
      mockComputeSwapFees.mockResolvedValue([toBigInt(1), toBigInt(2)]);

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
      expect(result).toEqual([toBigInt(1), toBigInt(2)]);
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

      mockTryToUsd.mockResolvedValue(5.6);

      const amount = toBigInt(100);
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          false,
          false,
          toBigInt(1),
          amount,
          toBigInt(300),
          [toBigInt(1)],
          [toBigInt(2)],
          toBigInt(10),
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
      expect(liq.target).toEqual(ZeroAddress);
      expect(liq.paused).toEqual(false);
      expect(liq.amount).toEqual('100');
      expect(liq.price).toEqual('300');
      expect(liq.wantAndIds).toEqual([2]);
      expect(liq.wantOrIds).toEqual([1]);
      expect(liq.timeToPay).toEqual(10);

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('300');

      const marketPrice = await MarketPrice.find({ network: net, marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.baseAddress).toEqual(market.baseAddress);
      expect(marketPrice.quoteAddress).toEqual(market.quoteAddress);
      expect(marketPrice.provider).toEqual(provider);
      expect(marketPrice.lid).toEqual(liq.lid);

      const event = await Event.find({ network: net, action: Events.LiquidityAdd });
      expect(event).toBeDefined();
      expect(event.marketAddress).toEqual(market.address);
      expect(event.lid).toEqual(liq.lid);
      expect(event.provider).toEqual(provider);
      expect(event.creator).toEqual(provider);
      expect(event.amount).toEqual(liq.amount);
      expect(event.price).toEqual(liq.price);
      expect(event.target).toEqual(liq.target);
      expect(event.timeToPay).toEqual(liq.timeToPay);
      expect(event.paused).toEqual(liq.paused);
    });

    it('should not update market total liquidity when liquidity has paused=true', async () => {
      await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseType: AssetType.ERC20,
        baseAddress: baseAddress,
        quote: QUOTE,
        quoteType: AssetType.SYNTH,
        quoteAddress: quoteAddress,
      });

      mockTryToUsd.mockResolvedValue(5.6);

      const amount = toBigInt(100);
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          false,
          true,
          toBigInt(1),
          amount,
          toBigInt(300),
          [toBigInt(1)],
          [toBigInt(2)],
          toBigInt(1),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.lid).toEqual(1);
    });

    it('should update the liquidity if it already exist and deduction=false', async () => {
      let market = await Market.create({
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
        price: '400',
        wantOrIds: [1],
        wantAndIds: [2],
        target: '0xTarget',
        lid: lid,
        timeToPay: 50,
      });

      const amount = toBigInt(10);
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          '0xNewTarget',
          false,
          false,
          toBigInt(lid),
          amount,
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(10),
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
      expect(liq.timeToPay).toEqual(10);
      expect(liq.target).toEqual('0xNewTarget');

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('430');

      const eventAdd = await Event.find({ network: net, action: Events.LiquidityAdd });
      expect(eventAdd).toBeDefined();
      expect(eventAdd.marketAddress).toEqual(market.address);
      expect(eventAdd.lid).toEqual(liq.lid);
      expect(eventAdd.provider).toEqual(provider);
      expect(eventAdd.creator).toEqual(provider);
      expect(eventAdd.amount).toEqual('10');

      const eventPriceUpdate = await Event.find({
        network: net,
        action: Events.LiquidityPriceUpdate,
      });
      expect(eventPriceUpdate).toBeDefined();
      expect(eventPriceUpdate.marketAddress).toEqual(market.address);
      expect(eventPriceUpdate.lid).toEqual(liq.lid);
      expect(eventPriceUpdate.provider).toEqual(provider);
      expect(eventPriceUpdate.creator).toEqual(provider);
      expect(eventPriceUpdate.price).toEqual(liq.price);

      const eventTarget = await Event.find({ network: net, action: Events.LiquidityTargetUpdate });
      expect(eventTarget).toBeDefined();
      expect(eventTarget.marketAddress).toEqual(market.address);
      expect(eventTarget.lid).toEqual(liq.lid);
      expect(eventTarget.provider).toEqual(provider);
      expect(eventTarget.creator).toEqual(provider);
      expect(eventTarget.target).toEqual('0xNewTarget');

      const eventTimeToPay = await Event.find({ network: net, action: Events.LiquidityTimeToPayUpdate });
      expect(eventTimeToPay).toBeDefined();
      expect(eventTimeToPay.marketAddress).toEqual(market.address);
      expect(eventTimeToPay.lid).toEqual(liq.lid);
      expect(eventTimeToPay.provider).toEqual(provider);
      expect(eventTimeToPay.creator).toEqual(provider);
      expect(eventTimeToPay.timeToPay).toEqual(10);
    });

    it('should update the liquidity if it already exist and deduction=true', async () => {
      let market = await Market.create({
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
        price: '400',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });

      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          true,
          false,
          toBigInt(lid),
          toBigInt(10),
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.amount).toEqual('90');

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('430');
    });

    it('when user has enabled messaging and the liquidity`s messaging status has not been updated, set it', async () => {
      await User.create({
        address: provider,
        messagingEnabled: true,
      });

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
        price: '400',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });

      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          true,
          false,
          toBigInt(lid),
          toBigInt(10),
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      let liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.messagingEnabled).toEqual(true);

      // Should not update messaging status if it has been updated previously
      await Liquidity.updateById(liq.id, {
        messagingEnabled: false,
        messagingEnabledUpdatedAt: moment().toISOString(),
      });
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          true,
          false,
          toBigInt(lid),
          toBigInt(10),
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.messagingEnabled).toEqual(false);
    });

    it('should remove liquidity amount from market total liquidity if paused=true and the reverse if paused=false', async () => {
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
        price: '400',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });

      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          false,
          true,
          toBigInt(lid),
          toBigInt(0),
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      let liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.amount).toEqual('100');
      expect(liq.paused).toEqual(true);

      // unpause the liquidity
      await expect(
        handler.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          false,
          false,
          toBigInt(lid),
          toBigInt(0),
          toBigInt(430),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();

      liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.paused).toEqual(false);
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
            ZeroAddress,
            true,
            false,
            toBigInt(lid),
            toBigInt(10),
            toBigInt(430),
            [toBigInt(3)],
            [toBigInt(4)],
            toBigInt(2),
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
      let market = await Market.create({
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
          ZeroAddress,
          false,
          true,
          toBigInt(1),
          [toBigInt(1)],
          toBigInt(300),
          [toBigInt(1)],
          [toBigInt(2)],
          toBigInt(1),
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
      expect(liq.target).toEqual(ZeroAddress);
      expect(liq.paused).toEqual(true);
      expect(liq.ids).toEqual([1]);
      expect(liq.amount).toEqual(liq.ids.length.toString());
      expect(liq.price).toEqual('300');
      expect(liq.wantAndIds).toEqual([2]);
      expect(liq.wantOrIds).toEqual([1]);
      expect(liq.timeToPay).toEqual(1);

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('300');

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
      });
      const lid = 1;
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
        ids: [1],
        wantOrIds: [1],
        wantAndIds: [2],
        amount: '1',
        lid: lid,
        price: '12',
      });

      await expect(
        handler.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          false,
          false,
          toBigInt(lid),
          [toBigInt(2)],
          toBigInt(10),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.provider).toEqual(provider);
      expect(liq.paused).toEqual(false);
      expect(liq.price).toEqual('10');
      expect(liq.ids).toEqual([1, 2]);
      expect(liq.amount).toEqual(liq.ids.length.toString());
      expect(liq.wantOrIds).toEqual([3]);
      expect(liq.wantAndIds).toEqual([4]);
      expect(liq.timeToPay).toEqual(2);

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('10');
    });

    it('should update the liquidity if it already exist and deduction=true', async () => {
      let market = await Market.create({
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
        ids: [1, 2],
        amount: '2',
        wantOrIds: [1],
        wantAndIds: [2],
        lid: lid,
      });

      await expect(
        handler.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          ZeroAddress,
          true,
          false,
          toBigInt(lid),
          [toBigInt(2), toBigInt(3)],
          toBigInt(10),
          [toBigInt(3)],
          [toBigInt(4)],
          toBigInt(2),
          undefined,
        ),
      ).resolves.toBeUndefined();
      const liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq).toBeDefined();
      expect(liq.ids).toEqual([1]);
      expect(liq.amount).toEqual(liq.ids.length.toString());

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('10');
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
            ZeroAddress,
            false,
            true,
            toBigInt(1),
            [toBigInt(1)],
            toBigInt(300),
            [toBigInt(1)],
            [toBigInt(2)],
            toBigInt(1),
            undefined,
          ),
        ).resolves.toBeUndefined();
        const marketPrice = await MarketPrice.find({ network: net, marketAddress });
        expect(marketPrice).toBeUndefined();
      });
    });
  });

  describe('.onUpdatedPrice', () => {
    it('should update liquidity price and add a new market price entry', async () => {
      let market = await Market.create({
        network: net,
        address: marketAddress,
        baseAddress,
        quoteAddress,
      });

      let liq = await Liquidity.create({
        network: net,
        lid: 0,
        marketAddress,
        baseAddress,
        quoteAddress,
        provider,
        amount: '10000',
        price: '200',
      });

      await expect(
        handler.onUpdatedPrice(marketAddress, provider, manager, toBigInt(liq.lid), toBigInt(100), {} as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.find({ id: liq.id });
      expect(liq.price).toEqual('100');

      market = await Market.getById(market.id, true);
      expect(market.lowestPrice).toEqual('100');

      const marketPrice = await MarketPrice.find({ marketAddress: liq.marketAddress });
      expect(marketPrice).toBeDefined();
      expect(marketPrice.price).toEqual('100');
      expect(marketPrice.provider).toEqual(liq.provider);

      const eventPriceUpdate = await Event.find({
        network: net,
        action: Events.LiquidityPriceUpdate,
      });
      expect(eventPriceUpdate).toBeDefined();
      expect(eventPriceUpdate.marketAddress).toEqual(market.address);
      expect(eventPriceUpdate.lid).toEqual(liq.lid);
      expect(eventPriceUpdate.provider).toEqual(provider);
      expect(eventPriceUpdate.creator).toEqual(manager);
      expect(eventPriceUpdate.price).toEqual('100');
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
        handler.onUpdatedLiquidityManager(marketAddress, provider, manager, ZeroAddress, {} as any),
      ).resolves.toBeUndefined();

      liq = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 0);
      liq2 = await Liquidity.getLiquidity(handler.network, marketAddress, provider, 1);
      expect(liq.manager).toEqual(manager);
      expect(liq2.manager).toEqual(manager);

      // create event for all liquidities
      let eventMgrUpdate = await Event.find({
        network: net,
        action: Events.LiquidityManagerUpdate,
        lid: liq.lid,
      });
      expect(eventMgrUpdate).toBeDefined();
      expect(eventMgrUpdate.marketAddress).toEqual(market.address);
      expect(eventMgrUpdate.lid).toEqual(liq.lid);
      expect(eventMgrUpdate.provider).toEqual(provider);
      expect(eventMgrUpdate.creator).toEqual(provider);
      expect(eventMgrUpdate.manager).toEqual(manager);

      eventMgrUpdate = await Event.find({
        network: net,
        action: Events.LiquidityManagerUpdate,
        lid: liq2.lid,
      });
      expect(eventMgrUpdate).toBeDefined();
      expect(eventMgrUpdate.marketAddress).toEqual(market.address);
      expect(eventMgrUpdate.lid).toEqual(liq2.lid);
      expect(eventMgrUpdate.provider).toEqual(provider);
      expect(eventMgrUpdate.creator).toEqual(provider);
      expect(eventMgrUpdate.manager).toEqual(manager);

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
      await handler.onProtocolFeeUpdated(
        toBigInt(10),
        toBigInt(2),
        toBigInt(12),
        toBigInt(1),
        toBigInt(2),
        toBigInt(3),
        {} as any,
      );
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.InstantSwapFeeBp))).value).toEqual('10');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.SynthSwapFeeBp))).value).toEqual('2');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.StableSwapFeeBp))).value).toEqual('12');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.FixedSynthSwapFee))).value).toEqual('1');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.FixedNFTSwapFee))).value).toEqual('2');
      expect((await Meta.get(Meta.makeNetKey(net, FeeName.InstantNFTSwapFeeBp))).value).toEqual('3');
    });
  });

  describe('.computeSwapUsdValue', () => {
    describe('instant market', () => {
      it('should calculate correctly for NFT/*', async () => {
        const market = await Market.create({
          network: net,
          address: randStr(),
          baseType: AssetType.ERC721,
          quoteType: AssetType.ERC20,
          baseAddress: baseAddress,
          quoteAddress: quoteAddress,
        });
        mockTryToUsd.mockResolvedValue(5.6);
        const amount = pow10(18).mul(10);
        const price = pow10(18).mul(2);
        const value = await handler.computeSwapUsdValue(market, toBigInt(amount), toBigInt(price));
        expect(mockTryToUsd).toHaveBeenCalledWith(net, price.toString(), quoteAddress);
        expect(value).toEqual('5.6');
      });

      it('should calculate correctly for ERC20/*', async () => {
        const market = await Market.create({
          network: net,
          address: randStr(),
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
          baseAddress: baseAddress,
          quoteAddress: quoteAddress,
        });
        mockTryToUsd.mockResolvedValue(5.6);
        const amount = pow10(18).mul(10);
        const price = pow10(18).mul(2);
        const value = await handler.computeSwapUsdValue(market, toBigInt(amount), toBigInt(price));
        expect(mockTryToUsd).toHaveBeenCalledWith(net, amount.toString(), baseAddress);
        expect(value).toEqual('5.6');
      });
    });

    describe('interactive market', () => {
      it('should calculate correctly for NFT/SYNTH', async () => {
        const market = await Market.create({
          network: net,
          address: randStr(),
          baseType: AssetType.ERC721,
          quoteType: AssetType.SYNTH,
          baseAddress: baseAddress,
          quoteAddress: quoteAddress,
          quoteDecimals: 18,
          base: 'BASE',
        });
        mockGet.mockResolvedValue(toDec(400));
        const amount = pow10(18).mul(10);
        const price = pow10(18).mul(2);
        const value = await handler.computeSwapUsdValue(market, toBigInt(amount), toBigInt(price));
        expect(value).toEqual('0.005');
        expect(mockGet).toHaveBeenCalledWith('BASE');
      });

      it('should calculate correctly for ERC20/SYNTH', async () => {
        const market = await Market.create({
          network: net,
          address: randStr(),
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          baseAddress: baseAddress,
          quoteAddress: quoteAddress,
          baseDecimals: 18,
        });
        mockTryToUsd.mockResolvedValue(5.6);
        const amount = pow10(18).mul(10);
        const price = pow10(18).mul(2);
        const value = await handler.computeSwapUsdValue(market, toBigInt(amount), toBigInt(price));
        expect(mockTryToUsd).toHaveBeenCalledWith(net, amount.toString(), baseAddress);
        expect(value).toEqual('5.6');
      });

      it('should calculate correctly for SYNTH/*', async () => {
        const market = await Market.create({
          network: net,
          address: randStr(),
          baseType: AssetType.SYNTH,
          quoteType: AssetType.ERC20,
          baseAddress: baseAddress,
          quoteAddress: quoteAddress,
          baseDecimals: 18,
          base: 'BASE',
        });
        mockGet.mockResolvedValue(toDec(400));
        const amount = pow10(18).mul(10);
        const price = pow10(18).mul(2);
        const value = await handler.computeSwapUsdValue(market, toBigInt(amount), toBigInt(price));
        expect(value).toEqual('0.025');
        expect(mockGet).toHaveBeenCalledWith('BASE');
      });
    });
  });

  describe('.onSwapOrder', () => {
    const lid = toBigInt(0);
    const liqAmt = powOf(200, 18);
    let market: Market;
    let liq: Liquidity;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        base: BASE,
        baseAddress: baseAddress,
        baseType: AssetType.ERC20,
        quote: QUOTE,
        quoteAddress: quoteAddress,
        quoteType: AssetType.SYNTH,
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress: marketAddress,
        provider: provider,
        lid: toNumber(lid),
        amount: liqAmt.toString(),
        totalSwaps: 1,
        paymentMethodId: '0xLiquidityPaymentMethod',
      });
    });

    it('should create swap correctly and send notification to liquidity provider', async () => {
      const takerUser = await User.create({ address: taker, defaultPaymentMethodId: '0xTakerPaymentMethod' });

      mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

      const cancelDuration = 300;
      const numTypeInfo = [
        toBigInt(2),
        lid,
        toBigInt(100),
        toBigInt(1),
        toBigInt(1),
        toBigInt(1),
        toBigInt(cancelDuration),
      ];
      const [orderId, , amount, , , operator] = numTypeInfo;

      mockTryToUsd.mockResolvedValue(5.6);

      await handler.onSwapOrder(
        marketAddress,
        provider,
        taker,
        ZeroAddress,
        numTypeInfo,
        [toBigInt(1)],
        [toBigInt(2)],
        {
          transactionHash: '0xTxHash',
          getBlock: jest.fn().mockResolvedValue({ timestamp: moment().unix() as any }),
        } as any,
      );
      const swap = await Swap.getByOrderId(toNumber(orderId));
      expect(swap).toBeDefined();
      expect(swap.marketAddress).toEqual(market.address);
      expect(swap.lid).toEqual(toNumber(lid));
      expect(swap.provider).toEqual(provider);
      expect(swap.taker).toEqual(taker);
      expect(swap.base).toEqual(market.base);
      expect(swap.baseAddress).toEqual(market.baseAddress);
      expect(swap.quote).toEqual(market.quote);
      expect(swap.quoteAddress).toEqual(market.quoteAddress);
      expect(swap.orderId).toEqual(2);
      expect(swap.amount).toEqual('100');
      expect(swap.price).toEqual('1');
      expect(swap.offerId).toEqual(0);
      expect(swap.providerIds).toEqual([1]);
      expect(swap.takerIds).toEqual([2]);
      expect(swap.operator).toEqual(toNumber(operator));
      expect(swap.protocolFee).toEqual('2');
      expect(swap.marketCreatorFee).toEqual('3');
      expect(swap.takerPaymentMethodId).toEqual(takerUser.defaultPaymentMethodId);
      expect(swap.providerPaymentMethodId).toEqual(liq.paymentMethodId);
      expect(moment(swap.cancelAt).diff(moment(), 's')).toBeGreaterThanOrEqual(299);

      liq = await Liquidity.getLiquidity(net, marketAddress, provider, toNumber(lid));
      expect(liq.openOrders).toEqual(1);
      expect(liq.amount).toEqual(toDec(liqAmt).sub(amount.toString()).toString());
      expect(liq.totalSwaps).toEqual(2);

      const event = await Event.find({ network: net, action: Events.LiquiditySwap });
      expect(event).toBeDefined();
      expect(event.marketAddress).toEqual(market.address);
      expect(event.lid).toEqual(toNumber(lid));
      expect(event.provider).toEqual(provider);
      expect(event.creator).toEqual(taker);
      expect(event.orderId).toEqual(swap.orderId);
      expect(event.swapId).toEqual(swap.id);

      market = await Market.getById(market.id, true);
      expect(market.totalSwaps).toEqual(1);
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
        const cancelDuration = 300;
        const numTypeInfo = [
          toBigInt(2),
          lid,
          toBigInt(100),
          toBigInt(1),
          toBigInt(1),
          toBigInt(1),
          toBigInt(cancelDuration),
        ];
        const [orderId, , , , ,] = numTypeInfo;
        await handler.onSwapOrder(
          marketAddress,
          provider,
          taker,
          ZeroAddress,
          numTypeInfo,
          [toBigInt(1)],
          [toBigInt(2)],
          {
            transactionHash: '0xTxHash',
            getBlock: jest.fn().mockResolvedValue({ timestamp: moment().unix() as any }),
          } as any,
        );
        const swap = await Swap.getByOrderId(toNumber(orderId));
        expect(swap).toBeDefined();
        expect(swap.amount).toEqual(liq.amount);
      });
    });

    describe('base asset is NFT', function () {
      it('should set swap amount to liquidity amount', async () => {
        await User.create({ address: taker, defaultPaymentMethodId: '0xTakerPaymentMethod' });

        await Market.updateById(market.id, { baseType: AssetType.ERC721 });
        mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });
        const cancelDuration = 300;
        const numTypeInfo = [
          toBigInt(2),
          lid,
          toBigInt(100),
          toBigInt(1),
          toBigInt(1),
          toBigInt(1),
          toBigInt(cancelDuration),
        ];
        const [orderId, , , , ,] = numTypeInfo;
        await handler.onSwapOrder(
          marketAddress,
          provider,
          taker,
          ZeroAddress,
          numTypeInfo,
          [toBigInt(1)],
          [toBigInt(2)],
          {
            transactionHash: '0xTxHash',
            getBlock: jest.fn().mockResolvedValue({ timestamp: moment().unix() as any }),
          } as any,
        );
        const swap = await Swap.getByOrderId(toNumber(orderId));
        expect(swap).toBeDefined();
        expect(swap.amount).toEqual(liq.amount);
      });
    });
  });

  describe('.onSwap', () => {
    const lid = toBigInt(0);
    let market: Market;
    let liq: Liquidity;
    const liqAmt = powOf(1000, 18);

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        baseAddress,
        base: BASE,
        quoteAddress,
        quote: QUOTE,
        amountSwapped: powOf(1, 18).toString(),
        totalSwaps: 1,
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress,
        baseAddress,
        quoteAddress,
        provider: provider,
        lid: toNumber(lid),
        price: powOf(1, 18).toString(),
        amount: liqAmt.toString(),
        amountSwapped: powOf(10, 18).toString(),
      });
    });

    describe('when orderId is unset (instant swap)', () => {
      beforeEach(async () => {
        await Market.updateById(market.id, {
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
        });
      });

      it('should create instant swap correctly and send notification to liquidity provider', async () => {
        mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });
        mockTryToUsd.mockResolvedValue(0.5);

        const numTypeInfo = [BigInt(0), lid, BigInt('1000000000000000000'), BigInt(1), BigInt(1), BigInt(1)];
        const [, , amount, price, offerId, operator] = numTypeInfo;
        const evt = { transactionHash: txHash } as any;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          ZeroAddress,
          releaser,
          numTypeInfo,
          false,
          [toBigInt(1), toBigInt(2)],
          [toBigInt(3), toBigInt(4)],
          evt,
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
        expect(swap.valueUsd).toEqual('0.5');
        expect(swap.price).toEqual(price.toString());
        expect(swap.instant).toBeTruthy();
        expect(swap.paid).toBeTruthy();
        expect(swap.released).toBeTruthy();
        expect(swap.offerId).toEqual(toNumber(offerId - BigInt(1)));
        expect(swap.operator).toEqual(toNumber(operator));
        expect(swap.providerIds).toEqual([1, 2]);
        expect(swap.takerIds).toEqual([3, 4]);
        expect(swap.protocolFee).toEqual('2');
        expect(swap.marketCreatorFee).toEqual('3');
        expect(swap.txHash).toEqual(txHash);

        liq = await Liquidity.getById(liq.id);
        expect(liq.amount).toEqual(toDec(liqAmt).sub(amount.toString()).toString());
        expect(liq.lastSwapAt).toBeDefined();
        expect(liq.amountSwapped).toEqual('11000000000000000000');
        expect(liq.totalSwaps).toEqual(1);

        market = await Market.getById(market.id, true);
        expect(market.lastSwapAt).toBeDefined();
        expect(market.amountSwapped).toEqual('2000000000000000000');
        expect(market.totalSwaps).toEqual(2);

        const event = await Event.find({ network: net, action: Events.LiquiditySwap });
        expect(event).toBeDefined();
        expect(event.marketAddress).toEqual(market.address);
        expect(event.lid).toEqual(toNumber(lid));
        expect(event.provider).toEqual(provider);
        expect(event.creator).toEqual(taker);
        expect(event.orderId).toEqual(0);
        expect(event.swapId).toEqual(swap.id);

        // expect(mockNotify).toHaveBeenCalledWith(NotificationID.NewInstantSwap, net, provider, {
        //   market,
        //   swap,
        //   liq,
        // });
      });

      describe('when quote is NFT', () => {
        it('should set swap amount to liquidity amount', async () => {
          mockTryToUsd.mockResolvedValue(0.5);
          mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

          await Market.updateById(market.id, { quoteType: AssetType.ERC721 });
          const numTypeInfo = [
            toBigInt(0),
            lid,
            toBigInt('1000000000000000000'),
            toBigInt(1),
            toBigInt(1),
            toBigInt(1),
          ];
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            ZeroAddress,
            releaser,
            numTypeInfo,
            false,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
            { transactionHash: txHash } as any,
          );
          const swap = await Swap.find({ network: net, marketAddress: market.address, lid: liq.lid });
          expect(swap.amount).toEqual(liq.amount);
        });
      });

      describe('when base is NFT', () => {
        it('should set swap amount to liquidity amount', async () => {
          mockTryToUsd.mockResolvedValue(0.5);
          mockComputeSwapFees.mockResolvedValue({ protocolFee: 2, marketCreatorFee: 3 });

          await Market.updateById(market.id, { baseType: AssetType.ERC721 });
          const numTypeInfo = [
            toBigInt(0),
            lid,
            toBigInt('1000000000000000000'),
            toBigInt(1),
            toBigInt(1),
            toBigInt(1),
          ];
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            ZeroAddress,
            releaser,
            numTypeInfo,
            false,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
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
      const orderId = toBigInt(1);
      let now: moment.Moment;

      beforeEach(async () => {
        mockGet.mockResolvedValue(toDec(0));
        mockTryToUsd.mockResolvedValue(6.5);

        now = moment();
        swap = await Swap.create({
          network: net,
          marketAddress: market.address,
          orderId: toNumber(orderId) - 1,
          amount: powOf(10, 18).toString(),
          provider,
          lid: toNumber(lid),
          taker,
          createdAt: now.clone().subtract('1', 'day').toISOString(),
          paidAt: now.clone().subtract('1', 'day').toISOString(),
        });

        await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: toNumber(orderId) - 1,
          disputeId: 0,
        });

        dispute = await Dispute.create({
          network: net,
          marketAddress: market.address,
          orderId: toNumber(orderId) - 1,
          disputeId: 1,
        });
      });

      it('should create swap, mark it as released and send notification to taker', async () => {
        await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
        await Liquidity.updateById(liq.id, { amount: powOf(1000, 18).toString(), totalSwaps: 1, openOrders: 2 });

        const numTypeInfo = [
          orderId,
          toBigInt(liq.lid),
          toBigInt(swap.amount),
          toBigInt(liq.price),
          toBigInt(1),
          toBigInt(1),
        ];
        const [, , amount, , ,] = numTypeInfo;
        const evt = { transactionHash: txHash } as any;

        await handler.onSwap(
          marketAddress,
          provider,
          taker,
          ZeroAddress,
          provider,
          numTypeInfo,
          true,
          [toBigInt(1), toBigInt(2)],
          [toBigInt(3), toBigInt(4)],
          evt,
        );

        swap = await Swap.find({ marketAddress: market.address });
        expect(swap).toBeDefined();
        expect(swap.marketAddress).toEqual(market.address);
        expect(swap.instant).toBeFalsy();
        expect(swap.released).toBeTruthy();
        expect(swap.finalizer).toEqual(provider);
        expect(swap.byDispute).toBeTruthy();
        expect(swap.finalizedAt).toBeDefined();
        expect(swap.valueUsd).toEqual('6.5');

        const liqUpd = await Liquidity.getLiquidity(net, marketAddress, provider, toNumber(lid));
        expect(liqUpd.openOrders).toEqual(1);
        expect(liqUpd.lastSwapAt).toBeDefined();
        expect(liqUpd.amountSwapped).toEqual(toDec(liq.amountSwapped).add(amount.toString()).toString());
        expect(liqUpd.totalSwaps).toEqual(1);
        expect(liqUpd.avgFinalizeDur).toBeGreaterThan(0);
        expect(liqUpd.avgReleaseDur).toBeGreaterThan(0);

        // should not update completion rate since swap was disputed
        expect(liq.completionRate).toEqual(0);

        const marketUpd = await Market.getById(market.id, true);
        expect(marketUpd.lastSwapAt).toBeDefined();
        expect(marketUpd.amountSwapped).toEqual(toDec(market.amountSwapped).add(amount.toString()).toString());
        expect(marketUpd.totalSwaps).toEqual(market.totalSwaps);
        expect(marketUpd.avgFinalizeDur).toBeGreaterThan(0);
        expect(marketUpd.avgReleaseDur).toBeGreaterThan(0);

        // should not update completion rate since swap was disputed
        expect(market.completionRate).toEqual(0);

        const event = await Event.find({ action: Events.SwapReleased });
        expect(event).toBeDefined();
        expect(event.network).toEqual(net);
        expect(event.marketAddress).toEqual(marketAddress);
        expect(event.orderId).toEqual(toNumber(orderId - BigInt(1)));
        expect(event.creator).toEqual(provider);

        // mark recent dispute as released
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.orderReleased).toBeTruthy();

        liq = await Liquidity.getById(liq.id);
        market = await Market.getById(market.id, true);
        swap = await Swap.find({ marketAddress: market.address });
        swap.market = market;

        expect(mockNotify).toHaveBeenCalledTimes(1);
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderReleased, net, taker, {
          market,
          liq,
          swap,
        });
      });

      describe('when order is released but a dispute had been created', () => {
        it('should set the dispute release status to true; set complete status of all draft task to true; create execute task if dispute was not fully drafted', async () => {
          await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
          await Liquidity.updateById(liq.id, { amount: powOf(1000, 18).toString(), totalSwaps: 1, openOrders: 2 });
          let task = await MineTask.create({
            type: MineTaskType.Draft,
            network: net,
            marketAddress: market.address,
            orderId: toNumber(orderId) - 1,
            disputeId: dispute.disputeId,
            completed: false,
          });

          let task2 = await MineTask.create({
            type: MineTaskType.Draft,
            network: net,
            marketAddress: market.address,
            orderId: toNumber(orderId) - 1,
            disputeId: dispute.disputeId,
            completed: true,
          });

          const numTypeInfo = [
            orderId,
            toBigInt(liq.lid),
            toBigInt(swap.amount),
            toBigInt(liq.price),
            toBigInt(1),
            toBigInt(1),
          ];
          const [, , , , ,] = numTypeInfo;
          const evt = { transactionHash: txHash } as any;

          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            ZeroAddress,
            provider,
            numTypeInfo,
            true,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
            evt,
          );

          swap = await Swap.find({ marketAddress: market.address });
          expect(swap).toBeDefined();

          // mark recent dispute as released
          dispute = await Dispute.getById(dispute.id);
          expect(dispute.orderReleased).toBeTruthy();

          // mark all draft tasks as completed
          task = await MineTask.getById(task.id);
          expect(task.completed).toBeTruthy();
          task2 = await MineTask.getById(task2.id);
          expect(task2.completed).toBeTruthy();

          // Update dispute to make it not fully drafted or marked as released
          dispute = await Dispute.updateById(dispute.id, {
            numMediators: 3,
            numMediatorsDrafted: 2,
            orderReleased: false,
          });

          // Re-run the handler
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            ZeroAddress,
            provider,
            numTypeInfo,
            true,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
            evt,
          );

          // Should create "execute" task
          const executeTask = await MineTask.find({
            type: MineTaskType.Execute,
            orderId: dispute.orderId,
            disputeId: dispute.disputeId,
          });
          expect(executeTask).toBeDefined();

          // Should not create another execute task
          await handler.onSwap(
            marketAddress,
            provider,
            taker,
            ZeroAddress,
            provider,
            numTypeInfo,
            true,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
            evt,
          );

          const count = await MineTask.count({
            type: MineTaskType.Execute,
            orderId: dispute.orderId,
            disputeId: dispute.disputeId,
          });
          expect(count).toEqual(1);
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
            ZeroAddress,
            releaser,
            [orderId, toBigInt(liq.lid), toBigInt(swap.amount), toBigInt(liq.price), toBigInt(1), toBigInt(1)],
            true,
            [toBigInt(1), toBigInt(2)],
            [toBigInt(3), toBigInt(4)],
            { transactionHash: txHash } as any,
          );

          liq = await Liquidity.getById(liq.id);
          market = await Market.getById(market.id, true);
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
    const orderId = toBigInt(1);
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
        baseAddress,
        quoteAddress,
      });

      liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider: provider,
        baseAddress,
        quoteAddress,
        lid,
        openOrders: 1,
        amount: liqAmt.toString(),
      });

      swap = await Swap.create({
        network: net,
        marketAddress: market.address,
        orderId: toNumber(orderId),
        amount: amount.toString(),
        provider: provider,
        taker: taker,
        lid,
        createdAt: now.clone().subtract(1, 'day').toISOString(),
      });
    });

    it('should mark order as cancelled and send notification to counterparty', async () => {
      mockTryToUsd.mockResolvedValue(5.6);

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
      expect(liq.amount).toEqual(toDec(liqAmt).add(amount.toString()).toFixed());
      expect(liq.avgFinalizeDur).toBeGreaterThan(0);

      market = await Market.getById(market.id, true);
      expect(market.avgFinalizeDur).toBeGreaterThan(0);

      const event = await Event.find({ action: Events.SwapCancelled });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(toNumber(orderId));
      expect(event.creator).toEqual(taker);

      // Should send notification to counterparty
      let notifData = { market, liq, swap };
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderCancelled, net, provider, notifData);
      mockNotify.mockClear();

      // When provider is the canceller
      await handler.onOrderCancelled(orderId, provider, byDispute, {} as any);
      market = await Market.getById(market.id, true);
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
        market = await Market.getById(market.id, true);
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

      const orderId = toBigInt(1);
      const amount = powOf(10, 18);
      await Swap.create({
        network: net,
        marketAddress,
        orderId: toNumber(orderId),
        lid: liq.lid,
        amount: amount.toString(),
        provider,
        taker,
      });

      const disputeDelayDur = 300;
      const payer = taker;
      const now = moment();
      await handler.onSwapOrderPaid(orderId, payer, toBigInt(disputeDelayDur), {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now.unix() }),
      } as any);

      // Make sure swap is marked as paid
      let swap = await Swap.find({ marketAddress: market.address });
      expect(swap).toBeDefined();
      expect(swap.paid).toBeTruthy();
      expect(swap.payer).toEqual(taker);
      expect(swap.paidAt).toBeDefined();
      expect(moment(swap.disputeFrom).diff(now, 's')).toBeGreaterThanOrEqual(299);

      const event = await Event.find({ action: Events.SwapPaid });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(toNumber(orderId));
      expect(event.creator).toEqual(swap.payer);

      liq = await Liquidity.getById(liq.id);
      expect(liq.avgPaymentDur).toBeGreaterThan(0);

      market = await Market.getById(market.id, true);
      expect(market.avgPaymentDur).toBeGreaterThan(0);

      swap.market = market;
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderPaid, net, provider, {
        swap,
        market,
      });

      // Should send notification to taker when base is SYNTH and quote ERC20
      market = await Market.updateById(market.id, { baseType: AssetType.SYNTH, quoteType: AssetType.ERC20 });
      await handler.onSwapOrderPaid(orderId, payer, toBigInt(disputeDelayDur), {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now.unix() }),
      } as any);

      swap = await Swap.getById(swap.id);
      market = await Market.getById(market.id, true);
      swap.market = market;
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapOrderPaid, net, provider, {
        swap,
        market,
      });
    });

    describe('market is managed', () => {
      it('should get dispute delay duration from the swap service instead of the one passed in the event', async () => {
        const market = await Market.create({
          network: net,
          address: marketAddress,
          manager: '0xManager',
          base: 'BASE',
          quote: 'QUOTE',
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
        });

        const liq = await Liquidity.create({
          network: net,
          marketAddress,
          provider,
          lid: 0,
        });

        const orderId = toBigInt(1);
        const amount = powOf(10, 18);
        await Swap.create({
          network: net,
          marketAddress,
          orderId: toNumber(orderId),
          lid: liq.lid,
          amount: amount.toString(),
          provider,
          taker,
        });

        mockGetDisputeDelayDur.mockResolvedValue(1000);

        const disputeDelayDur = 300;
        const payer = taker;
        const now = moment();
        await handler.onSwapOrderPaid(orderId, payer, toBigInt(disputeDelayDur), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now.unix() }),
        } as any);

        const swap = await Swap.find({ marketAddress: market.address });
        expect(swap).toBeDefined();
        expect(moment(swap.disputeFrom).diff(now, 's')).toBeGreaterThanOrEqual(999);
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
      await expect(
        handler.onTogglePause(marketAddress, provider, toBigInt(lid), true, {} as any),
      ).resolves.toBeUndefined();
      liq = await Liquidity.getById(liq.id);
      expect(liq.paused).toBeTruthy();

      const eventPause = await Event.find({ network: net, action: Events.LiquidityPause });
      expect(eventPause).toBeDefined();
      expect(eventPause.marketAddress).toEqual(marketAddress);
      expect(eventPause.lid).toEqual(liq.lid);
      expect(eventPause.provider).toEqual(provider);
      expect(eventPause.creator).toEqual(provider);
      expect(eventPause.paused).toEqual(true);
    });
  });

  describe('.onTransferredToFeePool', () => {
    it('should create mine task', async () => {
      const token = '0xToken';
      const convToken = '0xConvToken';
      const convAmount = toBigInt(100);
      const amount = toBigInt(10);
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
      await expect(
        handler.onProtocolFeeSplitUpdated(toBigInt(1), toBigInt(2), toBigInt(3), {} as any),
      ).resolves.toBeUndefined();
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Inventor))).toHaveProperty('value', '1');
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Shared))).toHaveProperty('value', '2');
      expect(await Meta.get(Meta.makeNetKey(net, ProtocolFeeBeneficiary.Operator))).toHaveProperty('value', '3');
    });
  });

  describe('.onNewOffer', function () {
    it('should create new offer in database', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        manager: userAddr,
      });

      const lid = toBigInt(0);
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        lid: toNumber(lid),
        provider,
      });

      const offerId = toBigInt(1);
      const amount = powOf(10, 18);
      const price = powOf(1, 18);
      const ids = [toBigInt(1), toBigInt(2)];
      const dur = toBigInt(200);
      const now = moment().unix();
      await expect(
        handler.onNewOffer(marketAddress, provider, lid, taker, offerId, toBigInt(amount), toBigInt(price), ids, dur, {
          transactionHash: '0xTxHash',
          getBlock: jest.fn().mockResolvedValue({ timestamp: now as any }),
        } as any),
      ).resolves.toBeUndefined();

      const offer = await Offer.getByOfferId(toNumber(offerId - BigInt(1)));
      expect(offer.network).toEqual(net);
      expect(offer.marketAddress).toEqual(marketAddress);
      expect(offer.provider).toEqual(provider);
      expect(offer.lid).toEqual(toNumber(lid));
      expect(offer.creator).toEqual(taker);
      expect(offer.amount).toEqual(amount.toString());
      expect(offer.price).toEqual(price.toString());
      expect(offer.ids).toEqual(ids.map((id) => toNumber(id)));
      expect(moment(offer.deadline).toISOString()).toEqual(moment.unix(toNumber(dur) + now).toISOString());

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferCreate });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(offer.creator);
      expect(offerEvent.action).toEqual(Events.OfferCreate);
      expect(offerEvent.amount).toEqual(offer.amount.toString());
      expect(offerEvent.price).toEqual(offer.price.toString());
      expect(offerEvent.ids).toEqual(offer.ids);

      const liqEventOffer = await Event.find({ network: net, action: Events.LiquidityOffer });
      expect(liqEventOffer).toBeDefined();
      expect(liqEventOffer.marketAddress).toEqual(market.address);
      expect(liqEventOffer.lid).toEqual(liq.lid);
      expect(liqEventOffer.provider).toEqual(provider);
      expect(liqEventOffer.creator).toEqual(taker);
      expect(liqEventOffer.offerId).toEqual(toNumber(offerId) - 1);

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
        creator: taker,
      });

      const now = moment().unix();
      const dur = 200;
      await expect(
        handler.onOfferUpdated(toBigInt(1), taker, toBigInt(2), toBigInt(3), [toBigInt(4)], toBigInt(dur), {
          transactionHash: '0xTxHash',
          getBlock: jest.fn().mockResolvedValue({ timestamp: now as any }),
        } as any),
      ).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.amount).toEqual('2');
      expect(offer.price).toEqual('3');
      expect(offer.ids).toEqual([4]);
      expect(moment(offer.deadline).toISOString()).toEqual(moment.unix(now + dur).toISOString());

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferUpdate });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(offer.creator);
      expect(offerEvent.action).toEqual(Events.OfferUpdate);
      expect(offerEvent.amount).toEqual(offer.amount.toString());
      expect(offerEvent.price).toEqual(offer.price.toString());
      expect(offerEvent.ids).toEqual(offer.ids);

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

      const now = moment().unix();
      const execDelayDur = 200;
      await expect(
        handler.onOfferAccepted(toBigInt(1), provider, toBigInt(execDelayDur), {
          transactionHash: '0xTxHash',
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.accepted).toBeTruthy();
      expect(moment(offer.execAt).toISOString()).toEqual(moment.unix(now + execDelayDur).toISOString());

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferAccept });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(provider);
      expect(offerEvent.action).toEqual(Events.OfferAccept);

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
        creator: taker,
      });

      await expect(handler.onOfferCancelled(toBigInt(1), taker, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.cancelled).toBeTruthy();

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferCancel });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(taker);
      expect(offerEvent.action).toEqual(Events.OfferCancel);

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
        creator: taker,
        accepted: true,
        execAt: moment().toISOString(),
      });

      await expect(handler.onOfferUnaccepted(toBigInt(1), taker, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.accepted).toBeFalsy();
      expect(offer.execAt).toBeNull();

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferUnaccept });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(taker);
      expect(offerEvent.action).toEqual(Events.OfferUnaccept);

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferUnaccepted, net, taker, {
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
        creator: taker,
      });

      await expect(handler.onOfferExecuted(toBigInt(1), taker, {} as any)).resolves.toBeUndefined();

      offer = await Offer.getByOfferId(offer.offerId);
      expect(offer).toBeDefined();
      expect(offer.executed).toBeTruthy();

      const offerEvent = await Event.find({ network: net, offerId: offer.offerId, action: Events.OfferExecute });
      expect(offerEvent).toBeDefined();
      expect(offerEvent.network).toEqual(offer.network);
      expect(offerEvent.creator).toEqual(taker);
      expect(offerEvent.action).toEqual(Events.OfferExecute);

      expect(mockNotify).toHaveBeenCalledWith(NotificationID.OfferExecuted, net, provider, {
        offer,
        market,
        liq,
      });
    });
  });

  describe('.onUpdatedLiquiditySwapBadges', function () {
    it("should update liquidity provider's badges", async () => {
      const lid = toBigInt(0);
      let liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider,
        lid: toNumber(lid),
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
    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('evidenceDur', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'evidenceDur');
      expect(value).toEqual('1');
    });
  });
});

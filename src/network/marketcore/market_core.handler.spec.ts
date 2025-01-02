import { ChainNames, getChainByName } from '@jointlabs/meta';
import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/notifications/common';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import LiquidityProvider from '../../models/market_provider';
import Meta, { MetaKeys } from '../../models/meta';
import PermittedTrader from '../../models/permitted_trader';
import { toBigInt } from '../common';
import { MarketCoreHandler } from './market_core.handler';

// eslint-disable-next-line no-var
var mockFindTokenInSynthetic: jest.Mock<any, any, any>;
jest.mock('@jointlabs/meta', () => {
  mockFindTokenInSynthetic = jest.fn();
  const orig = jest.requireActual('@jointlabs/meta');
  return {
    ...orig,
    findTokenInSynthetic: mockFindTokenInSynthetic,
  };
});

const mockGetMarket = jest.fn();
const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {
    getMarket: mockGetMarket,
  };
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('MarketCoreHandler', () => {
  const db = DBService.getForTest();
  const net: ChainNames = 'ethereum';
  const marketAddress = '0xMarket';
  const txHash = '0xTxHash';
  const creator = '0xCreator';
  const userAddr = '0xUser';
  let handler: MarketCoreHandler;
  const marketCoreContract = new MarketCoreContract();
  const contracts = {
    marketCore: marketCoreContract,
  };
  const netSrv = new MockNetworkService();

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotify.mockReset();
    jest.resetModules();

    handler = new MarketCoreHandler(netSrv, new MockNotifierService(), null, net, contracts);
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onNewMarket', () => {
    const creator = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const baseAsset = '0x076BCfCf983C9E22d5785C177e7473BF608c4eC1';
    const quoteAsset = '0x75A3Feece9E1CE14807feff83Da432a32a1de14F';
    const base = 'BTC';
    const quote = 'USD';

    beforeEach(async () => {
      handler.newContract = (addressOrName: string): any => {
        switch (addressOrName) {
          case baseAsset:
            return {
              symbol: jest.fn().mockResolvedValue(base),
              decimals: jest.fn().mockResolvedValue(18),
            };
          case quoteAsset:
            return {
              symbol: jest.fn().mockResolvedValue(quote),
              decimals: jest.fn().mockResolvedValue(18),
            };
        }
      };
    });

    describe('new ERC20/ERC20 market', function () {
      it('should create market', async () => {
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC20,
            true,
            true,
            toBigInt(1),
            toBigInt(1),
            { transactionHash: txHash } as any,
          ),
        ).resolves.toBeUndefined();
        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.network).toEqual(handler.network);
        expect(market.creator).toEqual(creator);
        expect(market.base).toEqual(base);
        expect(market.baseDecimals).toEqual(18);
        expect(market.baseAddress).toEqual(baseAsset);
        expect(market.quoteAddress).toEqual(quoteAsset);
        expect(market.quote).toEqual(quote);
        expect(market.quoteDecimals).toEqual(18);
        expect(market.baseType).toEqual(AssetType.ERC20);
        expect(market.quoteType).toEqual(AssetType.ERC20);
        expect(market.commission).toEqual(1);
        expect(market.pair).toEqual(`${base}${quote}`);
        expect(market.txHash).toEqual(txHash);
        expect(market.permPut).toEqual(true);
        expect(market.permSwap).toEqual(true);
        expect(market.mediatorPoolId).toEqual(1);
      });
    });

    describe('new ERC20/NATIVE market', function () {
      it('should create market and set correct symbol and decimals', async () => {
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.NATIVE,
            false,
            false,
            toBigInt(1),
            toBigInt(1),
            { transactionHash: txHash } as any,
          ),
        ).resolves.toBeUndefined();

        const chainInfo = getChainByName(net);

        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.quote).toEqual(chainInfo.symbol);
        expect(market.quoteType).toEqual(AssetType.NATIVE);
        expect(market.quoteDecimals).toEqual(18);
        expect(market.pair).toEqual(`${base}${chainInfo.symbol}`);
      });
    });

    describe('new ERC20/SYNTH market', function () {
      it('should create market and fetch synthetic asset symbol and decimal from internal list', async () => {
        mockFindTokenInSynthetic.mockReturnValue({
          asset: '',
          type: 'SYNTHETIC',
          address: quoteAsset,
          symbol: quote,
          decimals: 10,
          isSynthetic: true,
        });
        const evt = { transactionHash: txHash } as any;
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.SYNTH,
            true,
            true,
            toBigInt(1),
            toBigInt(1),
            evt,
          ),
        ).resolves.toBeUndefined();
        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.base).toEqual(base);
        expect(market.baseAddress).toEqual(baseAsset);
        expect(market.quoteAddress).toEqual(quoteAsset);
        expect(market.quote).toEqual(quote);
        expect(market.baseType).toEqual(AssetType.ERC20);
        expect(market.baseDecimals).toEqual(18);
        expect(market.quoteType).toEqual(AssetType.SYNTH);
        expect(market.quoteDecimals).toEqual(10);
        expect(market.pair).toEqual(`${base}${quote}`);
      });

      describe('when SYNTH asset is unknown in the token list', function () {
        it('should create market and use defaults for synthetic-related fields', async () => {
          mockFindTokenInSynthetic.mockReturnValue(undefined);
          await expect(
            handler.onNewMarket(
              marketAddress,
              creator,
              baseAsset,
              quoteAsset,
              AssetType.ERC20,
              AssetType.SYNTH,
              true,
              true,
              toBigInt(1),
              toBigInt(1),
              { transactionHash: txHash } as any,
            ),
          ).resolves.toBeUndefined();
          const market = await Market.getByAddress(marketAddress);
          expect(market).toBeDefined();
          expect(market.base).toEqual(base);
          expect(market.baseAddress).toEqual(baseAsset);
          expect(market.quoteAddress).toEqual(quoteAsset);
          expect(market.quote).toEqual('???');
          expect(market.quoteDecimals).toEqual(18);
          expect(market.pair).toEqual(`${market.base}${market.quote}`);
        });
      });
    });

    describe('new ERC20/ERC721 market', function () {
      it('should create market but not set decimal for ERC271 asset', async () => {
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC721,
            true,
            true,
            toBigInt(1),
            toBigInt(1),
            { transactionHash: txHash } as any,
          ),
        ).resolves.toBeUndefined();
        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.quote).toEqual(quote);
        expect(market.quoteType).toEqual(AssetType.ERC721);
        expect(market.quoteDecimals).toEqual(0);
        expect(market.pair).toEqual(`${base}${quote}`);
      });
    });

    describe('new ERC20/ERC1155 market', function () {
      it('should create market but not set symbol and decimal for ERC1155 asset', async () => {
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC1155,
            true,
            true,
            toBigInt(1),
            toBigInt(1),
            { transactionHash: txHash } as any,
          ),
        ).resolves.toBeUndefined();
        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.quote).toEqual('');
        expect(market.quoteType).toEqual(AssetType.ERC1155);
        expect(market.quoteDecimals).toEqual(0);
        expect(market.pair).toEqual(`${base}`);
      });
    });

    describe('new NATIVE/ERC20 market', function () {
      it('should create market and set correct symbol and decimals', async () => {
        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.NATIVE,
            AssetType.ERC20,
            false,
            false,
            toBigInt(1),
            toBigInt(1),
            { transactionHash: txHash } as any,
          ),
        ).resolves.toBeUndefined();

        const chainInfo = getChainByName(net);

        const market = await Market.getByAddress(marketAddress);
        expect(market).toBeDefined();
        expect(market.base).toEqual(chainInfo.symbol);
        expect(market.baseType).toEqual(AssetType.NATIVE);
        expect(market.baseDecimals).toEqual(18);
        expect(market.quote).toEqual(quote);
        expect(market.quoteType).toEqual(AssetType.ERC20);
        expect(market.quoteDecimals).toEqual(18);
        expect(market.pair).toEqual(`${chainInfo.symbol}${quote}`);
        expect(market.instant).toBeTruthy();
      });
    });
  });

  describe('.onUpdatedMarketBadges', function () {
    it('should correctly update existing market badges', async () => {
      let market = await Market.create({
        network: net,
        address: marketAddress,
        requiredSwapBadges: ['badge/path', 'badge2'],
        requiredPutBadges: ['badge3/path', 'badge4'],
      });

      await expect(
        handler.onUpdatedMarketBadges(
          marketAddress,
          [['badge2', 'path2']],
          [
            ['badge2', 'path3'],
            ['badgeX', ''],
          ],
          null,
        ),
      ).resolves.toBeUndefined();

      market = await Market.getById(market.id);
      expect(market.requiredPutBadges).toEqual(['badge2/path2']);
      expect(market.requiredSwapBadges).toEqual(['badge2/path3', 'badgeX']);
    });
  });

  describe('.onEnabledZeroOfferPrice', () => {
    it('should set enabledZeroOfferPrice to true', async () => {
      let market = await Market.create({ network: net, address: marketAddress });
      await expect(handler.onEnabledZeroOfferPrice(market.address, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.enabledZeroOfferPrice).toBeTruthy();
    });
  });

  describe('.onTransferredOwnership', () => {
    it('should update creator', async () => {
      let market = await Market.create({ network: net, address: marketAddress, creator });
      await expect(handler.onTransferredOwnership(market.address, creator, userAddr, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.creator).toEqual(userAddr);
    });
  });

  describe('.onRenouncedMarket', () => {
    it('should update creator', async () => {
      let market = await Market.create({ network: net, address: marketAddress, creator });
      await expect(handler.onRenouncedMarket(market.address, creator, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.renounced).toEqual(true);
    });
  });

  describe('.onOfferOnlyEnabled', () => {
    it('should update creator', async () => {
      let market = await Market.create({ network: net, address: marketAddress });
      await expect(handler.onOfferOnlyEnabled(market.address, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.offerOnly).toBeTruthy();
    });
  });

  describe('.onMarketPutAllowed', () => {
    it('should create new Liquidity Provider', async () => {
      let liq = await Liquidity.create({ network: net, marketAddress, provider: userAddr, swapDisabled: true });
      let liq2 = await Liquidity.create({ network: net, marketAddress, provider: userAddr, swapDisabled: true });

      await expect(handler.onMarketPutAllowed(marketAddress, userAddr, {} as any)).resolves.toBeUndefined();

      const provider = await LiquidityProvider.find({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });
      expect(provider).toBeDefined();

      // Should re-enable liquidity
      liq = await Liquidity.getById(liq.id);
      expect(liq.swapDisabled).toBeFalsy();
      liq2 = await Liquidity.getById(liq2.id);
      expect(liq2.swapDisabled).toBeFalsy();
    });

    describe('when market provider already exist but soft-deleted', () => {
      it('should create new Liquidity Provider', async () => {
        const market = await Market.create({
          network: net,
          address: marketAddress,
          manager: userAddr,
        });

        const provider = await LiquidityProvider.create({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        });
        await LiquidityProvider.remove(provider.network, provider.marketAddress, provider.address);

        await expect(handler.onMarketPutAllowed(marketAddress, userAddr, {} as any)).resolves.toBeUndefined();

        const provider2 = await LiquidityProvider.find({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        });

        expect(provider2).toBeDefined();
        expect(provider.id).toEqual(provider2.id);
        expect(provider2.deletedAt).toBeNull();

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.PutApproved, net, provider.address, {
          market,
        });
      });
    });
  });

  describe('.onMarketPutRevoked', () => {
    it('should soft delete existing matching Liquidity Provider', async () => {
      const provider = await LiquidityProvider.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });

      let liq = await Liquidity.create({ network: net, marketAddress, provider: userAddr });
      let liq2 = await Liquidity.create({ network: net, marketAddress, provider: userAddr });

      await expect(handler.onMarketPutRevoked(marketAddress, userAddr, {} as any)).resolves.toBeUndefined();
      const provider2 = await LiquidityProvider.getById(provider.id);
      expect(provider2).toBeUndefined();

      const provider3 = await LiquidityProvider.query().where('id', provider.id).first();
      expect(provider3).toBeDefined();
      expect(provider3.deletedAt).toBeDefined();

      // Liquidity should be marked as disabled
      liq = await Liquidity.getById(liq.id);
      expect(liq.swapDisabled).toBeTruthy();
      liq2 = await Liquidity.getById(liq2.id);
      expect(liq2.swapDisabled).toBeTruthy();

      // expect notification to have been sent
      const market = await Market.getById(marketAddress);
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.PutRevoked, net, provider.address, {
        market,
      });
    });
  });

  describe('.onAllowedSwap', () => {
    let market: Market;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        manager: userAddr,
      });
    });

    it('should create permission for address', async () => {
      await handler.onAllowedSwap(marketAddress, userAddr, {} as any);
      const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(net, marketAddress, userAddr);
      expect(perm).toBeDefined();
      expect(perm.network).toEqual(net);
      expect(perm.address).toEqual(userAddr);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapApproved, net, perm.address, {
        market,
      });
    });

    it('should undo soft delete when existing entry was previously soft-deleted', async () => {
      let perm = await PermittedTrader.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
        deletedAt: moment().toISOString(),
      });
      await handler.onAllowedSwap(marketAddress, userAddr, {} as any);
      perm = await PermittedTrader.find({ id: perm.id });
      expect(perm.deletedAt).toBeNull();
    });
  });

  describe('.onRevokedSwap', () => {
    it('should soft delete permission', async () => {
      const market = await Market.create({
        network: net,
        address: marketAddress,
        manager: userAddr,
      });

      let perm = await PermittedTrader.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });
      await handler.onRevokedSwap(perm.marketAddress, perm.address, {} as any);
      perm = await PermittedTrader.query()
        .where({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        })
        .first();
      expect(perm.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapRevoked, net, perm.address, { market });
    });
  });

  describe('.onUpdatedCommission', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({ network: net, address: marketAddress, commission: 1 });
      await expect(handler.onUpdatedCommission(marketAddress, toBigInt(2), null)).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.commission).toEqual(2);
    });
  });

  describe('.onUpdatedDisputeDurations', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({ network: net, address: marketAddress });
      await expect(handler.onUpdatedDisputeDelayDuration(marketAddress, toBigInt(1), null)).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.disputeDelayDur).toEqual(1);
    });
  });

  describe('.onUpdatedMarketManager', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({
        network: net,
        address: marketAddress,
        manager: userAddr,
      });
      await expect(handler.onUpdatedMarketManager(marketAddress, '0xNewManager', null)).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.manager).toEqual('0xNewManager');
    });
  });

  describe('.onParameterUpdate', () => {
    it('should update native asset address', async () => {
      await expect(handler.onParameterUpdate('nativeAssetAddr', '0xNewAsset', null)).resolves.toBeUndefined();
      const upd = await Meta.get(Meta.makeNetKey(net, MetaKeys.ContractsParams));
      expect(upd).toBeDefined();
      const value = await Meta.getContractParam(net, 'nativeAssetAddr');
      expect(value).toEqual('0xNewAsset');
    });
  });
});

import { MarketCoreHandler } from './market_core.handler';
import { DBService } from '../../db/DBService';
import Market, { AssetType } from '../../models/market';
import { NoopLogger } from '../../common/loggers/noop_logger';
import LiquidityProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import * as moment from 'moment';
import PermittedTrader from '../../models/permitted_trader';
import { NotificationID } from '../../jobs/mailer/NotifierService';
import { BigNumber } from 'ethers';
import MarketBadge, { BadgeScope } from '../../models/market_badge';
import { toBN } from '../common';
import { TokenLists } from '../../common/token_list';

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
  const net = 'net';
  const marketAddress = '0xMarket';
  const badge = 'badge';
  const path = 'path';
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
              decimals: jest.fn().mockResolvedValue(toBN(18)),
            };
          case quoteAsset:
            return {
              symbol: jest.fn().mockResolvedValue(quote),
              decimals: jest.fn().mockResolvedValue(toBN(18)),
            };
        }
      };
    });

    describe('new ERC20/ERC20 market', function () {
      it('should create market', async () => {
        mockGetMarket.mockResolvedValue({
          perms: {
            put: true,
            swap: true,
            mediate: true,
          },
          mediatorBond: BigNumber.from('1000'),
        });

        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC20,
            BigNumber.from(1),
            BigNumber.from(10),
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
        expect(market.numMediators).toEqual(10);
        expect(market.permPut).toEqual(true);
        expect(market.permSwap).toEqual(true);
        expect(market.permMediate).toEqual(true);
        expect(market.mediatorBond).toEqual('1000');
      });
    });

    describe('new ERC20/SYNTH market', function () {
      it('should create market and fetch synthetic asset symbol and decimal from internal list', async () => {
        TokenLists.synthetic.tokens = [{ address: quoteAsset, symbol: quote, decimals: 10 }];

        mockGetMarket.mockResolvedValue({
          perms: {
            put: true,
            swap: true,
            mediate: true,
          },
          mediatorBond: BigNumber.from('1000'),
        });

        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.SYNTH,
            BigNumber.from(1),
            BigNumber.from(10),
            { transactionHash: txHash } as any,
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
    });

    describe('new ERC20/ERC721 market', function () {
      it('should create market but not set decimal for ERC271 asset', async () => {
        mockGetMarket.mockResolvedValue({
          perms: {
            put: true,
            swap: true,
            mediate: true,
          },
          mediatorBond: BigNumber.from('1000'),
        });

        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC721,
            BigNumber.from(1),
            BigNumber.from(10),
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
      it('should create market but not set symbol and decimal for ERC271 asset', async () => {
        mockGetMarket.mockResolvedValue({
          perms: {
            put: true,
            swap: true,
            mediate: true,
          },
          mediatorBond: BigNumber.from('1000'),
        });

        await expect(
          handler.onNewMarket(
            marketAddress,
            creator,
            baseAsset,
            quoteAsset,
            AssetType.ERC20,
            AssetType.ERC1155,
            BigNumber.from(1),
            BigNumber.from(10),
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
  });

  describe('.onUpdatedMarketBadges', function () {
    it('should correctly update existing market badges', async () => {
      const put = await MarketBadge.create({
        network: net,
        marketAddress,
        badge,
        path,
        scope: BadgeScope.PUT,
      });

      const swap = await MarketBadge.create({
        network: net,
        marketAddress,
        badge,
        path: '',
        scope: BadgeScope.SWAP,
      });

      await MarketBadge.create({
        network: net,
        marketAddress,
        badge: 'badge2',
        path: 'path2',
        scope: BadgeScope.MEDIATE,
      });

      await expect(
        handler.onUpdatedMarketBadges(marketAddress, [['badge2', 'path2']], [['badge2', 'path3']], [['', '']], null),
      ).resolves.toBeUndefined();

      const updPut = await MarketBadge.find({ marketAddress, scope: BadgeScope.PUT });
      expect(updPut.badge).not.toEqual(put.badge);
      expect(updPut.badge).toEqual('badge2');
      expect(updPut.path).not.toEqual(put.path);
      expect(updPut.path).toEqual('path2');

      const updSwap = await MarketBadge.find({ marketAddress, scope: BadgeScope.SWAP });
      expect(updSwap.badge).not.toEqual(swap.badge);
      expect(updSwap.badge).toEqual('badge2');
      expect(updSwap.path).not.toEqual(swap.path);
      expect(updSwap.path).toEqual('path3');

      const updMediate = await MarketBadge.find({ marketAddress, scope: BadgeScope.MEDIATE });
      expect(updMediate).toBeUndefined();
    });
  });

  describe('.onZeroPriceEnabled', () => {
    it('should set allowZeroPrice to true', async () => {
      let market = await Market.create({ network: net, address: marketAddress });
      await expect(handler.onZeroPriceEnabled(market.address, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.allowZeroPrice).toBeTruthy();
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

  describe('.onOfferOnlyEnabled', () => {
    it('should update creator', async () => {
      let market = await Market.create({ network: net, address: marketAddress });
      await expect(handler.onOfferOnlyEnabled(market.address, null)).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.offerOnly).toBeTruthy();
    });
  });

  describe('.onMarketPutAllowed', () => {
    it('should create new MarketProvider', async () => {
      await expect(handler.onMarketPutAllowed(marketAddress, userAddr, {} as any)).resolves.toBeUndefined();
      const provider = await LiquidityProvider.find({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });
      expect(provider).toBeDefined();
    });

    describe('when market provider already exist but soft-deleted', () => {
      it('should create new MarketProvider', async () => {
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
          marketAddress: provider.marketAddress,
        });
      });
    });
  });

  describe('.onMarketPutRevoked', () => {
    it('should soft delete existing matching MarketProvider', async () => {
      const provider = await LiquidityProvider.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });

      await expect(handler.onMarketPutRevoked(marketAddress, userAddr, {} as any)).resolves.toBeUndefined();
      const provider2 = await LiquidityProvider.getById(provider.id);
      expect(provider2).toBeUndefined();

      const provider3 = await LiquidityProvider.query().where('id', provider.id).first();
      expect(provider3).toBeDefined();
      expect(provider3.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.PutRevoked, net, provider.address, {
        marketAddress: provider.marketAddress,
      });
    });
  });

  describe('.onInvitedMediator', () => {
    it('should create invitation', async () => {
      await handler.onInvitedMediator(marketAddress, userAddr, {} as any);
      const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(net, marketAddress, userAddr);
      expect(invite).toBeDefined();
      expect(invite.network).toEqual(net);
      expect(invite.address).toEqual(userAddr);
      expect(invite.accepted).toBeFalsy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.MediatorInviteReceived, net, userAddr, {
        marketAddress: invite.marketAddress,
      });
    });

    it(
      'should undo soft delete and set `accepted` to false when existing' + ' entry was previously soft-deleted',
      async () => {
        let invite = await InvitedMediator.create({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
          accepted: true,
          deletedAt: moment().toISOString(),
        });
        await handler.onInvitedMediator(marketAddress, userAddr, {} as any);
        invite = await InvitedMediator.find({ id: invite.id });
        expect(invite.accepted).toBeFalsy();
        expect(invite.deletedAt).toBeNull();

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.MediatorInviteReceived, net, userAddr, {
          marketAddress: invite.marketAddress,
        });
      },
    );
  });

  describe('.onUnInvitedMediator', () => {
    it('should soft delete unaccepted invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });
      await handler.onUnInvitedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        })
        .first();
      expect(invite).toBeDefined();
      expect(invite.deletedAt).toBeDefined();
      expect(invite.accepted).toBeFalsy();
    });

    it('should not soft delete accepted invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
        accepted: true,
      });
      await handler.onUnInvitedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        })
        .first();
      expect(invite).toBeDefined();
      expect(invite.deletedAt).toBeNull();
      expect(invite.accepted).toBeTruthy();
    });
  });

  describe('.onAcceptedMediatorInvite', () => {
    it('should mark invitation as `accepted`', async () => {
      await Market.create({ creator: creator, address: marketAddress });

      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });

      await handler.onAcceptedMediatorInvite(marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        })
        .first();
      expect(invite.accepted).toBeTruthy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.MediatorInviteAccepted, net, creator, {
        marketAddress: invite.marketAddress,
        invitee: userAddr,
      });
    });
  });

  describe('.onRevokedMediator', () => {
    it('should soft delete invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: marketAddress,
        address: userAddr,
      });

      await handler.onRevokedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: marketAddress,
          address: userAddr,
        })
        .first();
      expect(invite.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.MediatorRevoked, net, userAddr, {
        marketAddress: invite.marketAddress,
      });
    });
  });

  describe('.onAllowedSwap', () => {
    it('should create permission for address', async () => {
      await handler.onAllowedSwap(marketAddress, userAddr, {} as any);
      const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(net, marketAddress, userAddr);
      expect(perm).toBeDefined();
      expect(perm.network).toEqual(net);
      expect(perm.address).toEqual(userAddr);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapApproved, net, perm.address, {
        marketAddress: perm.marketAddress,
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
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.SwapRevoked, net, perm.address, {
        marketAddress: perm.marketAddress,
      });
    });
  });

  describe('.onUpdatedCommission', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({ network: net, address: marketAddress, commission: 1 });
      await expect(handler.onUpdatedCommission(marketAddress, toBN(2), null)).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.commission).toEqual(2);
    });
  });

  describe('.onUpdatedDisputeDurations', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({ network: net, address: marketAddress });
      await expect(
        handler.onUpdatedDisputeDurations(marketAddress, toBN(1), toBN(2), toBN(3), toBN(4), null),
      ).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.disputeDelayTime).toEqual(1);
      expect(updMkt.evidenceDur).toEqual(2);
      expect(updMkt.predictDur).toEqual(3);
      expect(updMkt.appealDur).toEqual(4);
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

  describe('.onUpdatedDisputeCost', function () {
    it('should update market correctly', async () => {
      const mkt = await Market.create({
        network: net,
        address: marketAddress,
        disputeCost: '1',
      });
      await expect(handler.onUpdatedDisputeCost(marketAddress, toBN(2), null)).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.disputeCost).toEqual('2');
    });
  });
});

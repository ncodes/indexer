import { MarketCoreHandler } from './market_core.handler';
import { DBService } from '../../db/DBService';
import Market, { AssetType } from '../../models/market';
import { NoopLogger } from '../../common/loggers/noop_logger';
import LiquidityProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import * as moment from 'moment';
import PermittedTrader from '../../models/permitted_trader';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import { BigNumber } from 'ethers';
import MarketBadge, { BadgeScope } from '../../models/market_badge';
import { toBN } from '../common';

const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockGetMarketCore = jest.fn();
const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    getMarketCore: mockGetMarketCore,
  };
});

describe('MarketCoreHandler', () => {
  const db = DBService.getForTest();
  const net = 'net';
  const marketAddress = '0xMarket';
  const badge = 'badge';
  const path = 'path';
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
    it('should create market', async () => {
      const creator = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const baseAsset = '0x076BCfCf983C9E22d5785C177e7473BF608c4eC1';
      const quoteAsset = '0x75A3Feece9E1CE14807feff83Da432a32a1de14F';

      const mockBaseContract = {
        symbol: jest.fn().mockResolvedValue('BTC'),
      };
      const mockQuoteContract = {
        symbol: jest.fn().mockResolvedValue('USDT'),
      };

      handler.newContract = (addressOrName: string): any => {
        switch (addressOrName) {
          case baseAsset:
            return mockBaseContract;
          case quoteAsset:
            return mockQuoteContract;
        }
      };

      mockGetMarketCore.mockReturnValue({
        getMarket: jest.fn().mockResolvedValue({
          permPut: true,
          permSwap: true,
          permMediate: true,
          mediatorBond: BigNumber.from('1000'),
        }),
      });

      await expect(
        handler.onNewMarket(
          '0x123',
          creator,
          baseAsset,
          quoteAsset,
          AssetType.SYNTH,
          AssetType.SYNTH,
          BigNumber.from(1),
          BigNumber.from(10),
          { transactionHash: '0xTxHash' } as any,
        ),
      ).resolves.toBeUndefined();
      const market = await Market.getByAddress('0x123');
      expect(market).toBeDefined();
      expect(market.network).toEqual(handler.network);
      expect(market.creator).toEqual(creator);
      expect(market.base).toEqual('BTC');
      expect(market.baseAddress).toEqual(baseAsset);
      expect(market.quoteAddress).toEqual(quoteAsset);
      expect(market.quote).toEqual('USDT');
      expect(market.baseType).toEqual(AssetType.SYNTH);
      expect(market.quoteType).toEqual(AssetType.SYNTH);
      expect(market.commission).toEqual(1);
      expect(market.pair).toEqual('BTCUSDT');
      expect(market.txHash).toEqual('0xTxHash');
      expect(market.numMediators).toEqual(10);
      expect(market.permPut).toEqual(true);
      expect(market.permSwap).toEqual(true);
      expect(market.permMediate).toEqual(true);
      expect(market.mediatorBond).toEqual('1000');
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
        handler.onUpdatedMarketBadges(
          marketAddress,
          [['badge2', 'path2']],
          [['badge2', 'path3']],
          [['', '']],
          null,
        ),
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
      let market = await Market.create({ network: net, address: marketAddress, creator: '0x1' });
      await expect(
        handler.onTransferredOwnership(market.address, '0x1', '0x2', null),
      ).resolves.toBeUndefined();
      market = await Market.getById(market.id);
      expect(market.creator).toEqual('0x2');
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
      await expect(
        handler.onMarketPutAllowed('0x123', '0xAddr', {} as any),
      ).resolves.toBeUndefined();
      const provider = await LiquidityProvider.find({
        network: net,
        marketAddress: '0x123',
        address: '0xAddr',
      });
      expect(provider).toBeDefined();
    });

    describe('when market provider already exist but soft-deleted', () => {
      it('should create new MarketProvider', async () => {
        const provider = await LiquidityProvider.create({
          network: net,
          marketAddress: '0x123',
          address: '0xAddr',
        });
        await LiquidityProvider.remove(provider.network, provider.marketAddress, provider.address);

        await expect(
          handler.onMarketPutAllowed('0x123', '0xAddr', {} as any),
        ).resolves.toBeUndefined();
        const provider2 = await LiquidityProvider.find({
          network: net,
          marketAddress: '0x123',
          address: '0xAddr',
        });
        expect(provider2).toBeDefined();
        expect(provider.id).toEqual(provider2.id);
        expect(provider2.deletedAt).toBeNull();

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotifyType.PutApproved, net, provider.address, {
          marketAddress: provider.marketAddress,
        });
      });
    });
  });

  describe('.onMarketPutRevoked', () => {
    it('should soft delete existing matching MarketProvider', async () => {
      const provider = await LiquidityProvider.create({
        network: net,
        marketAddress: '0x123',
        address: '0xAddr',
      });

      await expect(
        handler.onMarketPutRevoked('0x123', '0xAddr', {} as any),
      ).resolves.toBeUndefined();
      const provider2 = await LiquidityProvider.getById(provider.id);
      expect(provider2).toBeUndefined();

      const provider3 = await LiquidityProvider.query().where('id', provider.id).first();
      expect(provider3).toBeDefined();
      expect(provider3.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.PutRevoked, net, provider.address, {
        marketAddress: provider.marketAddress,
      });
    });
  });

  describe('.onInvitedMediator', () => {
    it('should create invitation', async () => {
      await handler.onInvitedMediator('0x123', '0xProvider', {} as any);
      const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(
        net,
        '0x123',
        '0xProvider',
      );
      expect(invite).toBeDefined();
      expect(invite.network).toEqual(net);
      expect(invite.address).toEqual('0xProvider');
      expect(invite.accepted).toBeFalsy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(
        NotifyType.MediationInviteReceived,
        net,
        '0xProvider',
        { marketAddress: invite.marketAddress },
      );
    });

    it(
      'should undo soft delete and set `accepted` to false when existing' +
        ' entry was previously soft-deleted',
      async () => {
        let invite = await InvitedMediator.create({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
          accepted: true,
          deletedAt: moment().toISOString(),
        });
        await handler.onInvitedMediator('0x123', '0xProvider', {} as any);
        invite = await InvitedMediator.find({ id: invite.id });
        expect(invite.accepted).toBeFalsy();
        expect(invite.deletedAt).toBeNull();

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(
          NotifyType.MediationInviteReceived,
          net,
          '0xProvider',
          { marketAddress: invite.marketAddress },
        );
      },
    );
  });

  describe('.onUnInvitedMediator', () => {
    it('should soft delete unaccepted invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
      });
      await handler.onUnInvitedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite).toBeDefined();
      expect(invite.deletedAt).toBeDefined();
      expect(invite.accepted).toBeFalsy();
    });

    it('should not soft delete accepted invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
        accepted: true,
      });
      await handler.onUnInvitedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite).toBeDefined();
      expect(invite.deletedAt).toBeNull();
      expect(invite.accepted).toBeTruthy();
    });
  });

  describe('.onAcceptedMediatorInvite', () => {
    it('should mark invitation as `accepted`', async () => {
      await Market.create({ creator: '0xCreator', address: '0x123' });
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
      });
      await handler.onAcceptedMediatorInvite(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite.accepted).toBeTruthy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.MediatorInviteAccepted, net, '0xCreator', {
        marketAddress: invite.marketAddress,
        invitee: '0xProvider',
      });
    });
  });

  describe('.onRevokedMediator', () => {
    it('should soft delete invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
      });
      await handler.onRevokedMediator(invite.marketAddress, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.MediatorRevoked, net, '0xProvider', {
        marketAddress: invite.marketAddress,
      });
    });
  });

  describe('onAllowedSwap', () => {
    it('should create permission for address', async () => {
      await handler.onAllowedSwap('0x123', '0xProvider', {} as any);
      const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(
        net,
        '0x123',
        '0xProvider',
      );
      expect(perm).toBeDefined();
      expect(perm.network).toEqual(net);
      expect(perm.address).toEqual('0xProvider');

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapApproved, net, perm.address, {
        marketAddress: perm.marketAddress,
      });
    });

    it('should undo soft delete when existing entry was previously soft-deleted', async () => {
      let perm = await PermittedTrader.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
        deletedAt: moment().toISOString(),
      });
      await handler.onAllowedSwap('0x123', '0xProvider', {} as any);
      perm = await PermittedTrader.find({ id: perm.id });
      expect(perm.deletedAt).toBeNull();
    });
  });

  describe('.onRevokedSwap', () => {
    it('should soft delete permission', async () => {
      let perm = await PermittedTrader.create({
        network: net,
        marketAddress: '0x123',
        address: '0xProvider',
      });
      await handler.onRevokedSwap(perm.marketAddress, perm.address, {} as any);
      perm = await PermittedTrader.query()
        .where({
          network: net,
          marketAddress: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(perm.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapRevoked, net, perm.address, {
        marketAddress: perm.marketAddress,
      });
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
        manager: '0xManager',
      });
      await expect(
        handler.onUpdatedMarketManager(marketAddress, '0xNewManager', null),
      ).resolves.toBeUndefined();
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
      await expect(
        handler.onUpdatedDisputeCost(marketAddress, toBN(2), null),
      ).resolves.toBeUndefined();
      const updMkt = await Market.getById(mkt.id);
      expect(updMkt.disputeCost).toEqual('2');
    });
  });
});

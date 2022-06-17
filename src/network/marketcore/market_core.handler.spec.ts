import { MarketCoreHandler } from './market_core.handler';
import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import { NoopLogger } from '../../common/loggers/noop_logger';
import MarketProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import * as moment from 'moment';
import PermittedTrader from '../../models/permitted_trader';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import { BigNumber } from 'ethers';

const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {};
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
  let handler: MarketCoreHandler;
  const marketCoreContract = new MarketCoreContract();
  const contracts = {
    marketCore: marketCoreContract,
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotify.mockReset();
    handler = new MarketCoreHandler(
      new MockNetworkService(),
      new MockNotifierService(),
      null,
      net,
      contracts,
    );
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

      await expect(
        handler.onNewMarket(
          '0x123',
          creator,
          baseAsset,
          quoteAsset,
          true,
          true,
          BigNumber.from(1),
          {} as any,
        ),
      ).resolves.toBeUndefined();
      const market = await Market.getByMarketId('0x123');
      expect(market).toBeDefined();
      expect(market.network).toEqual(handler.network);
      expect(market.creator).toEqual(creator);
      expect(market.base).toEqual('BTC');
      expect(market.baseAddress).toEqual(baseAsset);
      expect(market.quoteAddress).toEqual(quoteAsset);
      expect(market.quote).toEqual('USDT');
      expect(market.isBaseLocal).toBeTruthy();
      expect(market.isQuoteLocal).toBeTruthy();
      expect(market.commission).toEqual(1);
      expect(market.pair).toEqual('BTCUSDT');
    });
  });

  describe('.onMarketPutAllowed', () => {
    it('should create new MarketProvider', async () => {
      await expect(
        handler.onMarketPutAllowed('0x123', '0xAddr', {} as any),
      ).resolves.toBeUndefined();
      const provider = await MarketProvider.find({
        network: net,
        marketId: '0x123',
        address: '0xAddr',
      });
      expect(provider).toBeDefined();
    });

    describe('when market provider already exist but soft-deleted', () => {
      it('should create new MarketProvider', async () => {
        const provider = await MarketProvider.create({
          network: net,
          marketId: '0x123',
          address: '0xAddr',
        });
        await MarketProvider.remove(provider.network, provider.marketId, provider.address);

        await expect(
          handler.onMarketPutAllowed('0x123', '0xAddr', {} as any),
        ).resolves.toBeUndefined();
        const provider2 = await MarketProvider.find({
          network: net,
          marketId: '0x123',
          address: '0xAddr',
        });
        expect(provider2).toBeDefined();
        expect(provider.id).toEqual(provider2.id);
        expect(provider2.deletedAt).toBeNull();

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotifyType.PutApproved, net, provider.address, {
          marketId: provider.marketId,
        });
      });
    });
  });

  describe('.onMarketPutRevoked', () => {
    it('should soft delete existing matching MarketProvider', async () => {
      const provider = await MarketProvider.create({
        network: net,
        marketId: '0x123',
        address: '0xAddr',
      });

      await expect(
        handler.onMarketPutRevoked('0x123', '0xAddr', {} as any),
      ).resolves.toBeUndefined();
      const provider2 = await MarketProvider.getById(provider.id);
      expect(provider2).toBeUndefined();

      const provider3 = await MarketProvider.query().where('id', provider.id).first();
      expect(provider3).toBeDefined();
      expect(provider3.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.PutRevoked, net, provider.address, {
        marketId: provider.marketId,
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
        { marketId: invite.marketId },
      );
    });

    it(
      'should undo soft delete and set `accepted` to false when existing' +
        ' entry was previously soft-deleted',
      async () => {
        let invite = await InvitedMediator.create({
          network: net,
          marketId: '0x123',
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
          { marketId: invite.marketId },
        );
      },
    );
  });

  describe('.onUnInvitedMediator', () => {
    it('should soft delete unaccepted invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketId: '0x123',
        address: '0xProvider',
      });
      await handler.onUnInvitedMediator(invite.marketId, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketId: '0x123',
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
        marketId: '0x123',
        address: '0xProvider',
        accepted: true,
      });
      await handler.onUnInvitedMediator(invite.marketId, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketId: '0x123',
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
      await Market.create({ creator: '0xCreator', marketId: '0x123' });
      let invite = await InvitedMediator.create({
        network: net,
        marketId: '0x123',
        address: '0xProvider',
      });
      await handler.onAcceptedMediatorInvite(invite.marketId, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketId: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite.accepted).toBeTruthy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.MediatorInviteAccepted, net, '0xCreator', {
        marketId: invite.marketId,
        invitee: '0xProvider',
      });
    });
  });

  describe('.onRevokedMediator', () => {
    it('should soft delete invitation', async () => {
      let invite = await InvitedMediator.create({
        network: net,
        marketId: '0x123',
        address: '0xProvider',
      });
      await handler.onRevokedMediator(invite.marketId, invite.address, {} as any);
      invite = await InvitedMediator.query()
        .where({
          network: net,
          marketId: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(invite.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.MediatorRevoked, net, '0xProvider', {
        marketId: invite.marketId,
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
        marketId: perm.marketId,
      });
    });

    it('should undo soft delete when existing entry was previously soft-deleted', async () => {
      let perm = await PermittedTrader.create({
        network: net,
        marketId: '0x123',
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
        marketId: '0x123',
        address: '0xProvider',
      });
      await handler.onRevokedSwap(perm.marketId, perm.address, {} as any);
      perm = await PermittedTrader.query()
        .where({
          network: net,
          marketId: '0x123',
          address: '0xProvider',
        })
        .first();
      expect(perm.deletedAt).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.SwapRevoked, net, perm.address, {
        marketId: perm.marketId,
      });
    });
  });
});

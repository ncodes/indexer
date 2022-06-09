import { MarketCoreHandler } from './market_core.handler';
import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import { NoopLogger } from '../../common/loggers/noop_logger';
import MarketProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import * as moment from 'moment';

const MarketCoreContract = jest.fn().mockImplementation(() => {
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
    handler = new MarketCoreHandler(null, net, contracts);
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
        handler.onNewMarket('0x123', creator, baseAsset, quoteAsset, true, true, {} as any),
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
      expect(market.pair).toEqual('BTCUSDT');
    });
  });

  describe('.onMarketPutAllowed', () => {
    it('should create new MarketProvider', async () => {
      await expect(handler.onMarketPutAllowed('0x123', '0xAddr', {} as any)).resolves.toBeDefined();
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
        ).resolves.toBeDefined();
        const provider2 = await MarketProvider.find({
          network: net,
          marketId: '0x123',
          address: '0xAddr',
        });
        expect(provider2).toBeDefined();
        expect(provider.id).toEqual(provider2.id);
        expect(provider2.deletedAt).toBeNull();
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

      await expect(handler.onMarketPutRevoked('0x123', '0xAddr', {} as any)).resolves.toBeDefined();
      const provider2 = await MarketProvider.getById(provider.id);
      expect(provider2).toBeUndefined();

      const provider3 = await MarketProvider.query().where('id', provider.id).first();
      expect(provider3).toBeDefined();
      expect(provider3.deletedAt).toBeDefined();
    });
  });

  describe('.onInvitedMediator', () => {
    it('should create mediator', async () => {
      await handler.onInvitedMediator('0x123', '0xProvider', {} as any);
      const mediator = await InvitedMediator.findInvite(net, '0x123', '0xProvider');
      expect(mediator).toBeDefined();
      expect(mediator.network).toEqual(net);
      expect(mediator.address).toEqual('0xProvider');
      expect(mediator.accepted).toBeFalsy();
    });

    it('should undo soft delete and set `accepted` to false', async () => {
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
    });
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
    });
  });
});

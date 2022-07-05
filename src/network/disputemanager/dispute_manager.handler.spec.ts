import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DisputeManagerHandler } from './dispute_manager.handler';
import { toBN } from '../common';
import Swap from '../../models/swap';
import Market from '../../models/market';
import Dispute from '../../models/dispute';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import Commit from '../../models/commit';
import Reveal from '../../models/reveal';

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

describe('DisputeManagerHandler', () => {
  const db = DBService.getForTest();
  const net = 'net';
  let handler: DisputeManagerHandler;
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
    handler = new DisputeManagerHandler(
      new MockNetworkService(),
      new MockNotifierService(),
      null,
      net,
      contracts,
    );
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onDisputeCreated', () => {
    describe('with no previous existing dispute for the order', () => {
      it('should create dispute with correct fields', async () => {
        const orderId = toBN(1);
        const marketId = '0xMarket';
        const disputeId = toBN(1);

        await Market.create({
          network: net,
          marketId,
          numMediators: 3,
        });

        await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketId,
          provider: '0xProvider',
          taker: '0xTaker',
          base: 'BASE',
          quote: 'QUOTE',
        });

        process.env.DM_MAX_MEDIATOR_PER_DISPUTE = '3';
        process.env.DM_DISPUTE_COST = '100';

        await expect(
          handler.onDisputeCreated(orderId, '0xProvider', disputeId, true, {} as any),
        ).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(net, marketId, orderId.toNumber(), disputeId.toNumber());
        expect(dispute).toBeDefined();
        expect(dispute.wantRelease).toBeTruthy();
        expect(dispute.defendant).toEqual('0xTaker');
        expect(dispute.deposit).toEqual('0');
        expect(dispute.appeal).toBeFalsy();
        expect(dispute.numMediators).toEqual(3);

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotifyType.DisputeCreated, net, '0xTaker', {
          orderId: orderId.toNumber(),
          wantRelease: true,
          creator: '0xProvider',
          appeal: false,
          pair: `BASE/QUOTE`,
        });
      });
    });

    describe('with there is an existing dispute for the order', () => {
      it('should create dispute with correct fields', async () => {
        const orderId = toBN(1);
        const marketId = '0xMarket';
        const disputeId = toBN(1);

        await Market.create({
          network: net,
          marketId,
          numMediators: 3,
        });

        await Dispute.create({
          network: net,
          marketId,
          orderId: orderId.toNumber(),
        });

        await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketId,
          provider: '0xProvider',
          taker: '0xTaker',
          base: 'BASE',
          quote: 'QUOTE',
        });

        process.env.DM_MAX_MEDIATOR_PER_DISPUTE = '20';
        process.env.DM_DISPUTE_COST = '100';

        await expect(
          handler.onDisputeCreated(orderId, '0xTaker', disputeId, true, {} as any),
        ).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(net, marketId, orderId.toNumber(), disputeId.toNumber());
        expect(dispute).toBeDefined();
        expect(dispute.wantRelease).toBeTruthy();
        expect(dispute.defendant).toEqual('0xProvider');
        expect(dispute.deposit).toEqual('100');
        expect(dispute.appeal).toBeTruthy();
        expect(dispute.numMediators).toEqual(6);

        // expect notification to have been sent
        expect(mockNotify).toHaveBeenCalledWith(NotifyType.DisputeCreated, net, '0xProvider', {
          orderId: orderId.toNumber(),
          wantRelease: true,
          creator: '0xTaker',
          appeal: true,
          pair: `BASE/QUOTE`,
        });
      });
    });
  });

  describe('.onCommitted', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketId = '0xMarket';
      const disputeId = toBN(1);
      await expect(
        handler.onCommitted(marketId, orderId, disputeId, '0xCommitter', '0xHash', {} as any),
      ).resolves.toBeUndefined();

      const commit = await Commit.find({
        marketId,
        orderId: orderId.toNumber(),
      });
      expect(commit).toBeDefined();
      expect(commit.committer).toEqual('0xCommitter');
    });
  });

  describe('.onRevealed', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketId = '0xMarket';
      const disputeId = toBN(1);
      await expect(
        handler.onRevealed(marketId, orderId, disputeId, '0xRevealer', '1vote', {} as any),
      ).resolves.toBeUndefined();

      const reveal = await Reveal.find({
        marketId,
        orderId: orderId.toNumber(),
      });
      expect(reveal).toBeDefined();
    });
  });

  describe('.onDecisionExecuted', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketId = '0xMarket';
      const disputeId = toBN(1);

      await Dispute.create({
        network: net,
        marketId,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      });

      await expect(
        handler.onDecisionExecuted(
          marketId,
          orderId,
          disputeId,
          '0xExecutor',
          true,
          '0x31',
          toBN(100),
          {} as any,
        ),
      ).resolves.toBeUndefined();

      const dispute = await Dispute.get(net, marketId, orderId.toNumber(), disputeId.toNumber());
      expect(dispute.executed).toBeTruthy();
      expect(dispute.released).toBeTruthy();
    });
  });
});

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
import Draft from '../../models/draft';
import Liquidity from '../../models/liquidity';
import MineTask, { MineTaskType } from '../../models/mine_task';

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
  const cfg = {
    disputeCost: '100',
    maxMediatorPerDispute: '3',
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
    handler.getParam = (param) => {
      return cfg[param];
    };
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onDisputeCreated', () => {
    describe('with no previous existing dispute for the order', () => {
      it('should create dispute with correct fields', async () => {
        const orderId = toBN(1);
        const marketAddress = '0xMarket';
        const disputeId = toBN(1);

        let market = await Market.create({
          network: net,
          address: marketAddress,
          numMediators: 3,
          totalSwaps: 2,
        });

        let liquidity = await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider',
          totalSwaps: 2,
        });

        await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketAddress,
          provider: '0xProvider',
          taker: '0xTaker',
          base: 'BASE',
          quote: 'QUOTE',
        });

        await expect(
          handler.onDisputeCreated(orderId, '0xProvider', disputeId, true, {} as any),
        ).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(
          net,
          marketAddress,
          orderId.toNumber(),
          disputeId.toNumber(),
        );
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

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(1);
        expect(market.totalDisputes).toEqual(1);
        expect(market.disputeRate).toEqual(50);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(1);
        expect(liquidity.totalDisputes).toEqual(1);
        expect(liquidity.disputeRate).toEqual(50);

        // Expect draft mining task
        const q = {
          type: MineTaskType.Draft,
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
        };
        expect(await MineTask.count(q)).toEqual(3);
      });
    });

    describe('with there is an existing dispute for the order', () => {
      it('should create dispute with correct fields', async () => {
        const orderId = toBN(1);
        const marketAddress = '0xMarket';
        const disputeId = toBN(1);

        let market = await Market.create({
          network: net,
          address: marketAddress,
          numMediators: 3,
          openDisputes: 1,
          totalDisputes: 1,
        });

        let liquidity = await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider',
          openDisputes: 1,
          totalDisputes: 1,
        });

        await Dispute.create({
          network: net,
          marketAddress,
          orderId: orderId.toNumber(),
        });

        await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketAddress,
          provider: '0xProvider',
          taker: '0xTaker',
          base: 'BASE',
          quote: 'QUOTE',
        });

        cfg.maxMediatorPerDispute = '20';

        await expect(
          handler.onDisputeCreated(orderId, '0xTaker', disputeId, true, {} as any),
        ).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(
          net,
          marketAddress,
          orderId.toNumber(),
          disputeId.toNumber(),
        );
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

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(1);
        expect(market.totalDisputes).toEqual(1);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(1);
        expect(liquidity.totalDisputes).toEqual(1);

        // Expect draft mining task
        const q = {
          type: MineTaskType.Draft,
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
        };
        expect(await MineTask.count(q)).toEqual(6);
      });
    });
  });

  describe('.onCommitted', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketAddress = '0xMarket';
      const disputeId = toBN(1);
      await expect(
        handler.onCommitted(marketAddress, orderId, disputeId, '0xCommitter', '0xHash', {} as any),
      ).resolves.toBeUndefined();

      const commit = await Commit.find({
        marketAddress,
        orderId: orderId.toNumber(),
      });
      expect(commit).toBeDefined();
      expect(commit.committer).toEqual('0xCommitter');
    });
  });

  describe('.onRevealed', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketAddress = '0xMarket';
      const disputeId = toBN(1);
      await expect(
        handler.onRevealed(marketAddress, orderId, disputeId, '0xRevealer', '1vote', {} as any),
      ).resolves.toBeUndefined();

      const reveal = await Reveal.find({
        marketAddress,
        orderId: orderId.toNumber(),
      });
      expect(reveal).toBeDefined();
    });
  });

  describe('.onDecisionExecuted', () => {
    const orderId = toBN(1);
    const marketAddress = '0xMarket';
    const disputeId = toBN(1);
    let market: Market;
    let swap: Swap;
    let liquidity: Liquidity;
    const numMediators = 3;
    let executeTask: MineTask;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
        numMediators,
        openDisputes: 1,
        totalDisputes: 1,
      });

      liquidity = await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: '0xProvider',
        openDisputes: 1,
      });

      await Dispute.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        numMediators,
      });

      swap = await Swap.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        provider: '0xProvider',
        taker: '0xTaker',
        base: 'BASE',
        quote: 'QUOTE',
      });

      await Draft.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeIndex: disputeId.toNumber(),
        owner: '0xDrafted',
      });

      executeTask = await MineTask.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        type: MineTaskType.Execute,
      });
    });

    describe('when winningVote=0x31', () => {
      it('should consider dispute as released', async () => {
        await expect(
          handler.onDecisionExecuted(
            marketAddress,
            orderId,
            disputeId,
            '0xExecutor',
            true,
            '0x31',
            toBN(100),
            {} as any,
          ),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(
          net,
          marketAddress,
          orderId.toNumber(),
          disputeId.toNumber(),
        );
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeTruthy();

        // expect notification to have been sent
        const payload = {
          marketAddress,
          orderId: orderId.toNumber(),
          network: net,
          disputeId: disputeId.toNumber(),
          drafted: undefined,
          pair: swap.getPair(),
          outcome: 'Release',
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.DisputeExecuted,
          net,
          '0xProvider',
          payload,
        );
        expect(mockNotify).toHaveBeenNthCalledWith(
          2,
          NotifyType.DisputeExecuted,
          net,
          '0xTaker',
          payload,
        );
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(
          3,
          NotifyType.DisputeExecuted,
          net,
          '0xDrafted',
          payload,
        );

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(0);
        expect(market.totalDisputes).toEqual(1);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(0);

        // expect undraft mining task
        const q = {
          type: MineTaskType.Undraft,
          network: net,
          marketAddress: market.address,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
        };
        expect(await MineTask.count(q)).toEqual(numMediators);

        // expect execute task to be marked complete
        const task = await MineTask.getById(executeTask.id);
        expect(task.completed).toBeTruthy();
      });
    });

    describe('when winningVote=0x30', () => {
      it('should consider dispute as cancelled', async () => {
        await expect(
          handler.onDecisionExecuted(
            marketAddress,
            orderId,
            disputeId,
            '0xExecutor',
            true,
            '0x30',
            toBN(100),
            {} as any,
          ),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(
          net,
          marketAddress,
          orderId.toNumber(),
          disputeId.toNumber(),
        );
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeFalsy();

        // expect notification to have been sent
        const payload = {
          marketAddress,
          orderId: orderId.toNumber(),
          network: net,
          disputeId: disputeId.toNumber(),
          drafted: undefined,
          pair: swap.getPair(),
          outcome: 'Cancel',
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.DisputeExecuted,
          net,
          '0xProvider',
          payload,
        );

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(0);
        expect(market.totalDisputes).toEqual(1);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(0);
      });
    });

    describe('when winningVote=0x00 (or anything not 0x30 or 0x31)', () => {
      it('should consider dispute as stalled', async () => {
        await expect(
          handler.onDecisionExecuted(
            marketAddress,
            orderId,
            disputeId,
            '0xExecutor',
            true,
            '0x00',
            toBN(100),
            {} as any,
          ),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(
          net,
          marketAddress,
          orderId.toNumber(),
          disputeId.toNumber(),
        );
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeNull();

        // expect notification to have been sent
        const payload = {
          marketAddress,
          orderId: orderId.toNumber(),
          network: net,
          disputeId: disputeId.toNumber(),
          drafted: undefined,
          pair: swap.getPair(),
          outcome: 'Stalled',
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.DisputeExecuted,
          net,
          '0xProvider',
          payload,
        );

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(1);
        expect(market.totalDisputes).toEqual(1);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(1);
      });
    });
  });
});

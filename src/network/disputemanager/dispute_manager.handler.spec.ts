import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/mailer/common';
import Commit from '../../models/commit';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Event, { Events } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import Meta from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Reveal from '../../models/reveal';
import Swap from '../../models/swap';
import { toBN } from '../common';
import { DisputeManagerHandler } from './dispute_manager.handler';

const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockGrantPoint = jest.fn();
const MockPointService = jest.fn().mockImplementation(() => {
  return {
    grantPoint: mockGrantPoint,
  };
});

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    pointSrv: new MockPointService(),
  };
});

describe('DisputeManagerHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  const userAddr = '0xUser';
  const marketAddress = '0xMarket';
  const provider = '0xProvider';
  const taker = '0xTaker';
  let handler: DisputeManagerHandler;
  const marketCoreContract = new MarketCoreContract();
  const contracts = {
    marketCore: marketCoreContract,
  };
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotify.mockReset();
    handler = new DisputeManagerHandler(new MockNetworkService(), new MockNotifierService(), null, net, contracts);
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
        const disputeId = toBN(1);

        let market = await Market.create({
          network: net,
          address: marketAddress,
          totalSwaps: 2,
        });

        let liquidity = await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: provider,
          totalSwaps: 2,
        });

        const swap = await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketAddress,
          provider: provider,
          taker: taker,
          base: 'BASE',
          quote: 'QUOTE',
        });

        await Meta.update(
          Meta.makeMediatorPoolKey(net, 0),
          JSON.stringify({
            numDraftees: 3,
          }),
        );

        const evt = {} as any;
        await expect(handler.onDisputeCreated(orderId, provider, disputeId, true, evt)).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(net, marketAddress, orderId.toNumber(), disputeId.toNumber());
        expect(dispute).toBeDefined();
        expect(dispute.wantRelease).toBeTruthy();
        expect(dispute.defendant).toEqual(taker);
        expect(dispute.redispute).toBeFalsy();
        expect(dispute.numMediators).toEqual(3);

        // expect notification to have been sent
        swap.market = market;
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.DisputeCreated, net, taker, {
          dispute,
          swap,
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

        const event = await Event.find({ action: Events.SwapDisputed });
        expect(event).toBeDefined();
        expect(event.network).toEqual(net);
        expect(event.marketAddress).toEqual(marketAddress);
        expect(event.orderId).toEqual(orderId.toNumber());
        expect(event.creator).toEqual(provider);
        expect(event.disputeId).toEqual(disputeId.toNumber());

        expect(mockGrantPoint).toHaveBeenCalledWith('dispute:created', net, provider, evt, undefined);
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
          openDisputes: 1,
          totalDisputes: 1,
        });

        let liquidity = await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: provider,
          openDisputes: 1,
          totalDisputes: 1,
        });

        await Dispute.create({
          network: net,
          marketAddress,
          orderId: orderId.toNumber(),
        });

        const swap = await Swap.create({
          network: net,
          orderId: orderId.toNumber(),
          marketAddress,
          provider: provider,
          taker: taker,
          base: 'BASE',
          quote: 'QUOTE',
        });

        await Meta.update(
          Meta.makeMediatorPoolKey(net, 0),
          JSON.stringify({
            numDraftees: 3,
          }),
        );

        await expect(handler.onDisputeCreated(orderId, taker, disputeId, true, {} as any)).resolves.toBeUndefined();

        // Expect dispute to be created
        const dispute = await Dispute.get(net, marketAddress, orderId.toNumber(), disputeId.toNumber());
        expect(dispute).toBeDefined();
        expect(dispute.wantRelease).toBeTruthy();
        expect(dispute.defendant).toEqual(provider);
        expect(dispute.redispute).toBeTruthy();
        expect(dispute.numMediators).toEqual(3);

        // expect notification to have been sent
        swap.market = market;
        expect(mockNotify).toHaveBeenCalledWith(NotificationID.DisputeCreated, net, provider, {
          dispute,
          swap,
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
        expect(await MineTask.count(q)).toEqual(3);
      });
    });
  });

  describe('.onCommitted', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketAddress = '0xMarket';
      const disputeId = toBN(1);
      const evt = {} as any;
      await expect(
        handler.onCommitted(marketAddress, orderId, disputeId, '0xCommitter', toBN(1), '0xHash', evt),
      ).resolves.toBeUndefined();

      const commit = await Commit.find({
        marketAddress,
        orderId: orderId.toNumber(),
      });
      expect(commit).toBeDefined();
      expect(commit.committer).toEqual('0xCommitter');
      expect(commit.ticketIndex).toEqual(1);

      const event = await Event.find({ action: Events.SwapCommitted });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(orderId.toNumber());
      expect(event.creator).toEqual('0xCommitter');
      expect(event.disputeId).toEqual(disputeId.toNumber());

      expect(mockGrantPoint).toHaveBeenCalledWith('dispute:committed', net, '0xCommitter', evt, undefined);
    });
  });

  describe('.onRevealed', () => {
    it('should create a commit', async () => {
      const orderId = toBN(1);
      const marketAddress = '0xMarket';
      const disputeId = toBN(1);
      const evt = {} as any;
      await expect(
        handler.onRevealed(marketAddress, orderId, disputeId, '0xRevealer', toBN(1), '1vote', evt),
      ).resolves.toBeUndefined();

      const reveal = await Reveal.find({ marketAddress, orderId: orderId.toNumber() });
      expect(reveal).toBeDefined();
      expect(reveal.ticketIndex).toEqual(1);

      const event = await Event.find({ action: Events.SwapRevealed });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(orderId.toNumber());
      expect(event.creator).toEqual('0xRevealer');
      expect(event.disputeId).toEqual(disputeId.toNumber());
      expect(event.vote).toEqual('1vote');

      expect(mockGrantPoint).toHaveBeenCalledWith('dispute:revealed', net, '0xRevealer', evt, undefined);
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
        openDisputes: 1,
        totalDisputes: 1,
      });

      liquidity = await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: provider,
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
        provider: provider,
        taker: taker,
        base: 'BASE',
        quote: 'QUOTE',
      });

      await Draft.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeIndex: disputeId.toNumber(),
        owner: userAddr,
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
        const evt = {} as any;
        await expect(
          handler.onDecisionExecuted(marketAddress, orderId, disputeId, '0xExecutor', true, '0x31', evt),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(net, marketAddress, orderId.toNumber(), disputeId.toNumber());
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeTruthy();

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(0);
        expect(market.totalDisputes).toEqual(1);

        const event = await Event.find({ action: Events.SwapExecuted });
        expect(event).toBeDefined();
        expect(event.network).toEqual(net);
        expect(event.marketAddress).toEqual(marketAddress);
        expect(event.orderId).toEqual(orderId.toNumber());
        expect(event.creator).toEqual('0xExecutor');
        expect(event.disputeId).toEqual(disputeId.toNumber());

        // expect notification to have been sent
        swap.market = market;
        const payload = { dispute, swap, drafted: undefined };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.DisputeExecuted, net, provider, payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.DisputeExecuted, net, taker, payload);
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.DisputeExecuted, net, userAddr, payload);

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

        expect(mockGrantPoint).toHaveBeenCalledWith('dispute:executed', net, '0xExecutor', evt, undefined);
      });
    });

    describe('when winningVote=0x30', () => {
      it('should consider dispute as cancelled', async () => {
        await expect(
          handler.onDecisionExecuted(marketAddress, orderId, disputeId, '0xExecutor', true, '0x30', {} as any),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(net, marketAddress, orderId.toNumber(), disputeId.toNumber());
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeFalsy();

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(0);
        expect(market.totalDisputes).toEqual(1);

        // expect notification to have been sent
        swap.market = market;
        const payload = { dispute, swap, drafted: undefined };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.DisputeExecuted, net, provider, payload);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(0);
      });
    });

    describe('when winningVote=0x00 (or anything not 0x30 or 0x31)', () => {
      it('should consider dispute as stalled and not send notification to provider and taker', async () => {
        await expect(
          handler.onDecisionExecuted(marketAddress, orderId, disputeId, '0xExecutor', true, '0x00', {} as any),
        ).resolves.toBeUndefined();

        const dispute = await Dispute.get(net, marketAddress, orderId.toNumber(), disputeId.toNumber());
        expect(dispute.executed).toBeTruthy();
        expect(dispute.released).toBeNull();

        // expect market to be updated correctly
        market = await Market.getById(market.id);
        expect(market.openDisputes).toEqual(1);
        expect(market.totalDisputes).toEqual(1);

        // expect notification to have been sent
        swap.market = market;
        const payload = { dispute, swap, drafted: true };
        expect(mockNotify).toHaveBeenCalledTimes(1);
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.DisputeExecuted, net, userAddr, payload);

        // expect liquidity to be updated correctly
        liquidity = await Liquidity.getById(liquidity.id);
        expect(liquidity.openDisputes).toEqual(1);
      });
    });
  });
});

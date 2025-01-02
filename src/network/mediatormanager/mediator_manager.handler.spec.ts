import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/notifications/common';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Event, { Events } from '../../models/event';
import Market from '../../models/market';
import Meta, { MetaKeys } from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import PoolApproval from '../../models/pool_approval';
import Swap from '../../models/swap';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import { toBigInt, toNumber } from '../common';
import { MediatorManagerHandler } from './mediator_manager.handler';

const MarketCoreContract = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockGetContracts = jest.fn();
const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    getContracts: mockGetContracts,
  };
});

describe('MediatorManagerHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  const owner = '0xOwner';
  const creator = '0xCreator';
  const marketAddress = '0xMarket';
  const provider = '0xProvider';
  const taker = '0xTaker';
  const undrafter = '0xUndrafter';
  const drafter = '0xDrafter';
  let handler: MediatorManagerHandler;
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
    mockGetContracts.mockReset();
    handler = new MediatorManagerHandler(new MockNetworkService(), new MockNotifierService(), null, net, contracts);
    handler.logger = new NoopLogger() as any;

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        predictDur: 2,
        evidenceDur: 2,
      } as PoolParams),
    );

    await Meta.create(
      Meta.makeMediatorPoolKey(net, 0),
      JSON.stringify({
        ticketCancelDur: 604800,
        ticketExpireDur: 172800,
        predictDur: 2,
        evidenceDur: 2,
      } as Partial<ContractsParams>),
    );
  });

  describe('.onTicketPurchased', () => {
    it('should create ticket', async () => {
      const now = moment().unix();
      const evt = {
        transactionHash: '0xTxHash',
      } as any;
      await expect(
        handler.onTicketPurchased(
          owner,
          toBigInt(1),
          toBigInt(0),
          toBigInt(10),
          toBigInt(now + 1),
          toBigInt(now + 1),
          evt,
        ),
      ).resolves.toBeUndefined();
      const ticket = await Ticket.getByNetworkOwnerAndIndex(net, owner, 1);
      expect(ticket).toBeDefined();
      expect(ticket.bond).toEqual(toBigInt(10).toString());
      expect(ticket.matureAt).toBeDefined();
      expect(ticket.joinBy).toBeDefined();
      expect(ticket.joinBy).toBeDefined();
      expect(ticket.txHash).toEqual('0xTxHash');
    });
  });

  describe('.onTicketCancelled', () => {
    it('should set cancel date', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: owner,
        joined: true,
        poolId: 1,
      });
      const now = moment().unix();
      const evt = {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
      } as any;
      await expect(handler.onTicketCancelled(owner, toBigInt(1), evt)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.cancelAt).toBeDefined();
      expect(ticket.joined).toBeFalsy();
      expect(ticket.poolId).toBeNull();
      const expectedCancelAt = moment.unix(now + parseInt(await handler.getParam('ticketCancelDur')));
      expect(moment(ticket.cancelAt).unix()).toEqual(expectedCancelAt.unix());
    });
  });

  describe('.onTicketDrained', () => {
    it('should mark ticket as `drained`', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: owner,
      });
      const now = moment().unix();
      const evt = {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
      } as any;
      await expect(handler.onTicketDrained(owner, toBigInt(1), toBigInt(10), evt)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drained).toBeTruthy();
      expect(ticket.drainedAt).toBeDefined();
    });
  });

  describe('.onJoinedPool', () => {
    it('should set leave date and market ID', async () => {
      await Market.create({
        network: net,
        creator: creator,
        address: marketAddress,
      });
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: owner,
        bond: '100',
      });

      const now = moment().unix();
      const evt = {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
      } as any;
      await expect(handler.onJoinedPool(owner, toBigInt(1), toBigInt(1), evt)).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.poolId).toEqual(1);
      expect(ticket.joined).toBeTruthy();
    });
  });

  describe('.onDrafted', () => {
    beforeEach(async () => {
      await Market.create({
        network: net,
        creator: creator,
        address: marketAddress,
        mediatorPoolId: 0,
      });
    });

    it('should mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: owner,
      });

      const ticketId = toBigInt(1);
      const orderId = toBigInt(23);
      const disputeId = toBigInt(2);

      const swap = await Swap.create({
        network: net,
        marketAddress,
        orderId: toNumber(orderId),
        base: 'BASE',
        quote: 'QUOTE',
        provider: provider,
        taker: taker,
      });

      let dispute = await Dispute.create({
        network: net,
        marketAddress,
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
        numMediators: 1,
        numMediatorsDrafted: 0,
      });

      await Draft.create({
        network: net,
        marketAddress,
        disputeIndex: toNumber(disputeId),
        orderId: toNumber(orderId),
        owner: '0xDraftOwner1',
      });
      await Draft.create({
        network: net,
        marketAddress,
        disputeIndex: toNumber(disputeId),
        orderId: toNumber(orderId),
        owner: '0xDraftOwner2',
      });

      let draftTask = await MineTask.create({
        type: MineTaskType.Draft,
        network: net,
        marketAddress,
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
      });

      const now = moment().unix();
      const getBlock = jest.fn().mockResolvedValue({ timestamp: now });
      const evt = {
        getBlock,
      } as any;
      await expect(
        handler.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, drafter, evt),
      ).resolves.toBeUndefined();

      // Ticket should be updated correctly
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeTruthy();
      expect(ticket.orderId).toEqual(23);
      expect(ticket.draftedAt).toBeDefined();
      expect(ticket.disputeId).toEqual(2);

      // Draft record should be created
      const draft = await Draft.find({ ticketId: ticket.id });
      expect(draft).toBeDefined();
      expect(draft.disputeIndex).toEqual(2);
      expect(draft.disputeId).toEqual(dispute.id);

      // Dispute should be updated correctly
      const unix = moment.unix;
      dispute = await Dispute.getById(dispute.id);
      expect(dispute.numMediatorsDrafted).toEqual(1);
      const evidEndAt = now + ((await Meta.getContractParam(net, 'evidenceDur')) as number);
      expect(unix(evidEndAt).isSame(dispute.evidenceEndAt)).toBeTruthy();
      const expectedCommitEndAt = evidEndAt + ((await Meta.getContractParam(net, 'predictDur')) as number) / 2;
      expect(unix(expectedCommitEndAt).isSame(dispute.commitEndAt)).toBeTruthy();
      expect(
        unix((evidEndAt + (await Meta.getContractParam(net, 'predictDur'))) as number).isSame(dispute.predictEndAt),
      ).toBeTruthy();

      const event = await Event.find({ action: Events.SwapDrafted });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(toNumber(orderId));
      expect(event.draftee).toEqual(owner);
      expect(event.disputeId).toEqual(draft.disputeIndex);
      expect(event.creator).toEqual(drafter);

      expect(mockNotify).toBeCalledTimes(6);

      // expect notification to be sent to drafted ticket owner
      expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.TicketDrafted, net, owner, {
        owner: owner,
        ticketId: 1,
        dispute,
      });

      // expect FullyDrafted notification to be sent to swap participants
      const fullyDraftedLocal = {
        dispute,
        evidencePhaseHoursLeft: moment(dispute.evidenceEndAt).fromNow(true),
      };
      expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.FullyDrafted, net, swap.provider, fullyDraftedLocal);
      expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.FullyDrafted, net, swap.taker, fullyDraftedLocal);

      // expect EvidencePhaseStarted notification to be sent to drafted
      // ticket owners
      expect(mockNotify).toHaveBeenNthCalledWith(
        4,
        NotificationID.EvidencePhaseStarted,
        net,
        '0xDraftOwner1',
        fullyDraftedLocal,
      );
      expect(mockNotify).toHaveBeenNthCalledWith(
        5,
        NotificationID.EvidencePhaseStarted,
        net,
        '0xDraftOwner2',
        fullyDraftedLocal,
      );
      expect(mockNotify).toHaveBeenNthCalledWith(6, NotificationID.EvidencePhaseStarted, net, owner, fullyDraftedLocal);

      // expect a draft task to be marked `completed`
      draftTask = await MineTask.getById(draftTask.id);
      expect(draftTask.completed).toBeTruthy();

      // expect an `execute` dispute mining task to be created since
      // dispute is fully drafted (1 mediator)
      const execTask = await MineTask.find({
        marketAddress,
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
        type: MineTaskType.Execute,
      });
      expect(execTask).toBeDefined();

      // Call handler again to ensure new execute task is not created
      await expect(
        handler.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, drafter, evt),
      ).resolves.toBeUndefined();

      // expect no new execute task to be created
      const count = await MineTask.count({ type: MineTaskType.Execute });
      expect(count).toEqual(1);
    });

    describe('when not fully drafted', () => {
      it('should mark ticket as drafted', async () => {
        let ticket = await Ticket.create({
          network: net,
          index: 1,
          owner: owner,
        });

        const ticketId = toBigInt(1);
        const orderId = toBigInt(23);
        const disputeId = toBigInt(2);

        await Swap.create({
          network: net,
          marketAddress,
          orderId: toNumber(orderId),
          base: 'BASE',
          quote: 'QUOTE',
          provider: provider,
          taker: taker,
        });

        let dispute = await Dispute.create({
          network: net,
          marketAddress,
          orderId: toNumber(orderId),
          disputeId: toNumber(disputeId),
          numMediators: 2,
          numMediatorsDrafted: 0,
        });

        await Draft.create({
          network: net,
          marketAddress,
          disputeIndex: toNumber(disputeId),
          orderId: toNumber(orderId),
          owner: '0xDraftOwner1',
        });
        await Draft.create({
          network: net,
          marketAddress,
          disputeIndex: toNumber(disputeId),
          orderId: toNumber(orderId),
          owner: '0xDraftOwner2',
        });

        let draftTask = await MineTask.create({
          type: MineTaskType.Draft,
          network: net,
          marketAddress,
          orderId: toNumber(orderId),
          disputeId: toNumber(disputeId),
        });

        const now = moment().unix();
        const getBlock = jest.fn().mockResolvedValue({ timestamp: now });
        await expect(
          handler.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, drafter, {
            getBlock,
          } as any),
        ).resolves.toBeUndefined();

        // Ticket should be updated correctly
        ticket = await Ticket.getById(ticket.id);
        expect(ticket.drafted).toBeTruthy();
        expect(ticket.orderId).toEqual(23);
        expect(ticket.draftedAt).toBeDefined();
        expect(ticket.disputeId).toEqual(2);

        // Draft record should be created
        const draft = await Draft.find({ ticketId: ticket.id });
        expect(draft).toBeDefined();
        expect(draft.disputeIndex).toEqual(2);
        expect(draft.disputeId).toEqual(dispute.id);

        // Dispute should be updated correctly
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.numMediatorsDrafted).toEqual(1);
        expect(dispute.evidenceEndAt).toBeNull();
        expect(dispute.commitEndAt).toBeNull();
        expect(dispute.predictEndAt).toBeNull();

        expect(mockNotify).toBeCalledTimes(1);

        // expect notification to be sent to drafted ticket owner
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.TicketDrafted, net, owner, {
          owner: owner,
          ticketId: 1,
          dispute,
        });

        // expect a draft task to be marked `completed`
        draftTask = await MineTask.getById(draftTask.id);
        expect(draftTask.completed).toBeTruthy();

        // don't expect an `execute` dispute mining task to be created
        const execTask = await MineTask.find({ type: MineTaskType.Execute });
        expect(execTask).toBeUndefined();
      });
    });
  });

  describe('.onUndrafted', () => {
    it('should un-mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        poolId: 1,
        index: 1,
        owner: owner,
        orderId: 23,
        disputeId: 1,
      });

      let dispute = await Dispute.create({
        network: net,
        marketAddress,
        orderId: ticket.orderId,
        disputeId: ticket.disputeId,
        numMediatorsUndrafted: 1,
      });

      await Swap.create({
        network: net,
        marketAddress,
        orderId: ticket.orderId,
      });

      await MineTask.create({
        type: MineTaskType.Undraft,
        network: net,
        orderId: ticket.orderId,
        disputeId: ticket.disputeId,
      });

      await MineTask.create({
        type: MineTaskType.Undraft,
        network: net,
        orderId: ticket.orderId,
        disputeId: ticket.disputeId,
      });
      const evt = {} as any;
      await expect(handler.onUndrafted(owner, toBigInt(1), true, undrafter, evt)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeFalsy();
      expect(ticket.draftedAt).toBeNull();
      expect(ticket.orderId).toEqual(23);
      expect(ticket.disputeId).toEqual(1);

      dispute = await Dispute.getById(dispute.id);
      expect(dispute.numMediatorsUndrafted).toEqual(2);

      // expect an undraft mining task to be marked as `completed`
      let numCompleted = await MineTask.count({ type: MineTaskType.Undraft, completed: true });
      expect(numCompleted).toEqual(1);

      // not slashed
      await expect(handler.onUndrafted(owner, toBigInt(1), false, undrafter, {} as any)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeFalsy();
      expect(ticket.draftedAt).toBeNull();
      expect(ticket.orderId).toBeNull();
      expect(ticket.disputeId).toBeNull();

      // expect another undraft mining task to be marked as `completed`
      numCompleted = await MineTask.count({ type: MineTaskType.Undraft, completed: true });
      expect(numCompleted).toEqual(2);

      const event = await Event.find({ action: Events.SwapUndrafted });
      expect(event).toBeDefined();
      expect(event.network).toEqual(net);
      expect(event.marketAddress).toEqual(marketAddress);
      expect(event.orderId).toEqual(23);
      expect(event.disputeId).toEqual(1);
      expect(event.creator).toEqual(undrafter);
    });
  });

  describe('.onTicketBlocked', () => {
    it('should mark or unmark ticket as blocked', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        poolId: 1,
        owner: owner,
      });

      await expect(handler.onTicketBlocked(owner, toBigInt(1), true, undefined)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.blocked).toBeTruthy();

      await expect(handler.onTicketBlocked(owner, toBigInt(1), false, undefined)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.blocked).toBeFalsy();
    });
  });

  describe('.onTicketPaused', () => {
    it('should mark or unmark ticket as paused', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        poolId: 1,
        owner: owner,
      });

      const pauseDur = BigInt(86400);
      const now = moment().unix();
      const evt = {
        getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
      } as any;

      await expect(handler.onTicketPaused(owner, toBigInt(1), true, pauseDur, evt)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.paused).toBeTruthy();
      expect(ticket.pauseExpireAt).toBeDefined();
      expect(moment(ticket.pauseExpireAt).unix()).toEqual(moment.unix(now + Number(pauseDur)).unix());

      await expect(handler.onTicketPaused(owner, toBigInt(1), false, pauseDur, evt)).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.paused).toBeFalsy();
      expect(ticket.pauseExpireAt).toBeDefined();
      expect(moment(ticket.pauseExpireAt).unix()).toEqual(moment.unix(now + Number(pauseDur)).unix());
    });
  });

  describe('.onPoolApprovalUpdate', () => {
    it('should correctly handle pool approval', async () => {
      await expect(
        handler.onPoolApprovalUpdate(true, toBigInt(1), '0xAddress', true, {} as any),
      ).resolves.toBeUndefined();
      let approval = await PoolApproval.getByNetworkPoolIdAddress(net, 1, '0xAddress');
      expect(approval).toBeDefined();
      expect(approval.network).toEqual(net);
      expect(approval.approved).toBeTruthy();
      expect(approval.poolId).toEqual(1);
      expect(approval.address).toEqual('0xAddress');
      expect(approval.isMarket).toBeFalsy();

      await expect(
        handler.onPoolApprovalUpdate(true, toBigInt(1), '0xAddress', false, {} as any),
      ).resolves.toBeUndefined();
      approval = await PoolApproval.getByNetworkPoolIdAddress(net, 1, '0xAddress');
      expect(approval).toBeUndefined();

      await expect(
        handler.onPoolApprovalUpdate(false, toBigInt(1), '0xAddress', true, {} as any),
      ).resolves.toBeUndefined();
      approval = await PoolApproval.getByNetworkPoolIdAddress(net, 1, '0xAddress');
      expect(approval).toBeDefined();
      expect(approval.network).toEqual(net);
      expect(approval.approved).toBeTruthy();
      expect(approval.poolId).toEqual(1);
      expect(approval.address).toEqual('0xAddress');
      expect(approval.isMarket).toBeTruthy();
    });
  });

  describe('.onTicketSlashed', () => {
    it('should mark ticket as slashed, update bond and add a slash record', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        poolId: 1,
        owner: owner,
        bond: toBigInt(20).toString(),
        orderId: 23,
        joined: true,
      });

      const voted = true;
      const evt = {} as any;
      await expect(
        handler.onTicketSlashed(owner, toBigInt(1), toBigInt(10), voted, true, evt),
      ).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.slashed).toBeTruthy();
      expect(ticket.bond).toEqual(toBigInt(10).toString());
      expect(ticket.orderId).toBeNull();
      expect(ticket.joined).toBeFalsy();
      expect(ticket.poolId).toEqual(null);

      const slash = await TicketSlash.find({
        network: net,
        owner,
        index: 1,
      });
      expect(slash).toBeDefined();
      expect(slash.amount).toEqual(toBigInt(10).toString());
      expect(slash.voted).toBeTruthy();
      expect(slash.winSide).toBeTruthy();
      expect(slash.orderId).toBeNull();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.TicketSlashed, net, owner, {
        ticket,
        owner,
        voted,
        amount: '0.00000000000000001',
        asset: 'JOIN',
      });
    });
  });

  describe('.onTicketSlashedByOwner', () => {
    it("should mark ticket as slashed, update bond and add a slash record with 'byGov' set to true", async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        poolId: 1,
        owner: owner,
        bond: toBigInt(20).toString(),
        orderId: 23,
        joined: true,
      });

      const evt = {} as any;
      await expect(handler.onTicketSlashedByOwner(owner, toBigInt(1), toBigInt(10), evt)).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.slashed).toBeTruthy();
      expect(ticket.bond).toEqual(toBigInt(10).toString());
      expect(ticket.orderId).toBeNull();
      expect(ticket.joined).toBeFalsy();
      expect(ticket.poolId).toEqual(null);
      expect(ticket.blocked).toBeFalsy();

      const slash = await TicketSlash.find({
        network: net,
        owner,
        index: 1,
      });
      expect(slash).toBeDefined();
      expect(slash.amount).toEqual(toBigInt(10).toString());
      expect(slash.voted).toBeFalsy();
      expect(slash.winSide).toBeFalsy();
      expect(slash.orderId).toBeNull();
      expect(slash.byGov).toBeTruthy();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.TicketSlashed, net, owner, {
        ticket,
        owner,
        amount: '0.00000000000000001',
        asset: 'JOIN',
        byGov: true,
      });
    });
  });

  describe('.onParameterUpdate', function () {
    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('ticketCancelDur', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'ticketCancelDur');
      expect(value).toEqual('1');
    });
  });
});

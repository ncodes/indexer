import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/mailer/NotifierService';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Event, { Events } from '../../models/event';
import Market from '../../models/market';
import Meta, { MetaKeys } from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Swap from '../../models/swap';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import { toBN } from '../common';
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
      await expect(
        handler.onTicketPurchased(owner, toBN(1), toBN(0), toBN(10), toBN(now + 1), toBN(now + 1), {
          transactionHash: '0xTxHash',
        } as any),
      ).resolves.toBeUndefined();
      const ticket = await Ticket.getByNetworkOwnerAndIndex(net, owner, 1);
      expect(ticket).toBeDefined();
      expect(ticket.bond).toEqual(toBN(10).toString());
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
      await expect(
        handler.onTicketCancelled(owner, toBN(1), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();
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
      await expect(
        handler.onTicketDrained(owner, toBN(1), toBN(10), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();
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
      await expect(
        handler.onJoinedPool(owner, toBN(1), toBN(1), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

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
      });
    });

    it('should mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: owner,
      });

      const ticketId = toBN(1);
      const orderId = toBN(23);
      const disputeId = toBN(2);

      const swap = await Swap.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        base: 'BASE',
        quote: 'QUOTE',
        provider: provider,
        taker: taker,
      });

      let dispute = await Dispute.create({
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        numMediators: 1,
        numMediatorsDrafted: 0,
      });

      await Draft.create({
        network: net,
        marketAddress,
        disputeIndex: disputeId.toNumber(),
        orderId: orderId.toNumber(),
        owner: '0xDraftOwner1',
      });
      await Draft.create({
        network: net,
        marketAddress,
        disputeIndex: disputeId.toNumber(),
        orderId: orderId.toNumber(),
        owner: '0xDraftOwner2',
      });

      let draftTask = await MineTask.create({
        type: MineTaskType.Draft,
        network: net,
        marketAddress,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
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
      expect(event.orderId).toEqual(orderId.toNumber());
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
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        type: MineTaskType.Execute,
      });
      expect(execTask).toBeDefined();
    });

    describe('when not fully drafted', () => {
      it('should mark ticket as drafted', async () => {
        let ticket = await Ticket.create({
          network: net,
          index: 1,
          owner: owner,
        });

        const ticketId = toBN(1);
        const orderId = toBN(23);
        const disputeId = toBN(2);

        await Swap.create({
          network: net,
          marketAddress,
          orderId: orderId.toNumber(),
          base: 'BASE',
          quote: 'QUOTE',
          provider: provider,
          taker: taker,
        });

        let dispute = await Dispute.create({
          network: net,
          marketAddress,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
          numMediators: 2,
          numMediatorsDrafted: 0,
        });

        await Draft.create({
          network: net,
          marketAddress,
          disputeIndex: disputeId.toNumber(),
          orderId: orderId.toNumber(),
          owner: '0xDraftOwner1',
        });
        await Draft.create({
          network: net,
          marketAddress,
          disputeIndex: disputeId.toNumber(),
          orderId: orderId.toNumber(),
          owner: '0xDraftOwner2',
        });

        let draftTask = await MineTask.create({
          type: MineTaskType.Draft,
          network: net,
          marketAddress,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
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

      await expect(handler.onUndrafted(owner, toBN(1), true, undrafter, {} as any)).resolves.toBeUndefined();
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
      await expect(handler.onUndrafted(owner, toBN(1), false, undrafter, {} as any)).resolves.toBeUndefined();
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

  describe('.onTicketSlashed', () => {
    it('should mark ticket as slashed, update bond and add a slash record', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        poolId: 1,
        owner: owner,
        bond: toBN(20).toString(),
        orderId: 23,
        joined: true,
      });

      const voted = true;
      await expect(handler.onTicketSlashed(owner, toBN(1), toBN(10), voted, true, {} as any)).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.slashed).toBeTruthy();
      expect(ticket.bond).toEqual(toBN(10).toString());
      expect(ticket.orderId).toBeNull();
      expect(ticket.joined).toBeFalsy();
      expect(ticket.poolId).toEqual(null);

      const slash = await TicketSlash.find({
        network: net,
        owner,
        index: 1,
      });
      expect(slash).toBeDefined();
      expect(slash.amount).toEqual(toBN(10).toString());
      expect(slash.voted).toBeTruthy();
      expect(slash.winSide).toBeTruthy();
      expect(slash.orderId).toBeNull();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotificationID.TicketSlashed, net, owner, {
        ticket,
        owner,
        voted,
        amount: '0.00000000000000001',
        asset: 'P2P',
      });
    });
  });

  describe('.onParameterUpdate', function () {
    it('should throw error if contract params metadata has not been initialized', async () => {
      const key = Meta.makeNetKey(net, MetaKeys.ContractsParams);
      await Meta.update(key, '');
      await expect(handler.onParameterUpdate('ticketCancelDur', '1', {} as any)).rejects.toThrow(
        'Contracts params not initialized',
      );
    });

    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('ticketCancelDur', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'ticketCancelDur');
      expect(value).toEqual('1');
    });
  });
});

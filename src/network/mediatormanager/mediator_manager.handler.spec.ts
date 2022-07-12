import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import * as moment from 'moment';
import { MediatorManagerHandler } from './mediator_manager.handler';
import { toBN } from '../common';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import Draft from '../../models/draft';
import Market from '../../models/market';
import { NotifyType } from '../../jobs/mailer/NotifierService';
import Dispute from '../../models/dispute';
import Swap from '../../models/swap';

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
  const net = 'net';
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
    handler = new MediatorManagerHandler(
      new MockNetworkService(),
      new MockNotifierService(),
      null,
      net,
      contracts,
    );
    handler.logger = new NoopLogger() as any;
    await db.truncateTables();
  });

  describe('.onTicketPurchased', () => {
    it('should create ticket', async () => {
      const now = moment().unix();
      await expect(
        handler.onTicketPurchased('0xOwner', toBN(1), toBN(10), toBN(now + 1), toBN(now + 1), {
          transactionHash: '0xTxHash',
        } as any),
      ).resolves.toBeUndefined();
      const ticket = await Ticket.getByNetworkOwnerAndIndex(net, '0xOwner', 1);
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
        owner: '0xOwner',
      });
      const now = moment().unix();
      await expect(
        handler.onTicketCancelled('0xOwner', toBN(1), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.cancelAt).toBeDefined();
      const expectedCancelAt = moment.unix(now + parseInt(process.env.MM_TICKET_CANCEL_DUR));
      expect(moment(ticket.cancelAt).unix()).toEqual(expectedCancelAt.unix());
    });
  });

  describe('.onTicketDrained', () => {
    it('should mark ticket as `drained`', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
      });
      const now = moment().unix();
      await expect(
        handler.onTicketDrained('0xOwner', toBN(1), toBN(10), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drained).toBeTruthy();
      expect(ticket.drainedAt).toBeDefined();
    });
  });

  describe('.onJoinedMarket', () => {
    it('should set leave date and market ID', async () => {
      let market = await Market.create({
        network: net,
        creator: '0xCreator',
        marketId: '0xMarket',
        totalJoinedMediatorsBond: '100',
        numMediatorsJoined: 1,
      });
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
        bond: '100',
      });
      const now = moment().unix();
      await expect(
        handler.onJoinedMarket('0xOwner', '0xMarket', toBN(1), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.marketId).toEqual('0xMarket');
      expect(ticket.leaveAt).toBeDefined();
      const expectedLeaveAt = moment.unix(now + parseInt(process.env.MM_MIN_TICKET_TENURE_DUR));
      expect(moment(ticket.leaveAt).unix()).toEqual(expectedLeaveAt.unix());

      market = await Market.getById(market.id);
      expect(market.totalJoinedMediatorsBond).toEqual('200');
      expect(market.numMediatorsJoined).toEqual(2);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.JoinedMarket, net, '0xCreator', {
        marketId: '0xMarket',
        owner: '0xOwner',
        numTickets: '1',
      });
    });
  });

  describe('.onLeftMarket', () => {
    it('should unset leave date and market ID', async () => {
      let market = await Market.create({
        network: net,
        creator: '0xCreator',
        marketId: '0xMarket',
        numMediatorsJoined: 2,
        totalJoinedMediatorsBond: '200',
      });

      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
        bond: '100',
      });

      const now = moment().unix();
      await expect(
        handler.onLeftMarket('0xOwner', '0xMarket', toBN(1), {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.marketId).toBeNull();
      expect(ticket.leaveAt).toBeNull();
      const expectedLeaveAt = moment.unix(now + parseInt(process.env.MM_TICKET_EXPIRE_DUR));
      expect(moment(ticket.joinBy).unix()).toEqual(expectedLeaveAt.unix());

      market = await Market.getById(market.id);
      expect(market.numMediatorsJoined).toEqual(1);
      expect(market.totalJoinedMediatorsBond).toEqual('100');

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.LeftMarket, net, '0xCreator', {
        marketId: '0xMarket',
        owner: '0xOwner',
        numTickets: '0',
      });
    });
  });

  describe('.onDrafted', () => {
    it('should mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
      });

      const marketId = '0xMarket';
      const ticketId = toBN(1);
      const orderId = toBN(23);
      const disputeId = toBN(2);

      const swap = await Swap.create({
        network: net,
        marketId,
        orderId: orderId.toNumber(),
        base: 'BASE',
        quote: 'QUOTE',
        provider: '0xProvider',
        taker: '0xTaker',
      });

      let dispute = await Dispute.create({
        network: net,
        marketId,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        numMediators: 1,
        numMediatorsDrafted: 0,
      });

      await Draft.create({
        network: net,
        marketId,
        disputeId: disputeId.toNumber(),
        orderId: orderId.toNumber(),
        owner: '0xDraftOwner1',
      });
      await Draft.create({
        network: net,
        marketId,
        disputeId: disputeId.toNumber(),
        orderId: orderId.toNumber(),
        owner: '0xDraftOwner2',
      });

      const now = moment().unix();
      process.env.DM_EVIDENCE_DUR = '2';
      process.env.DM_PREDICT_DUR = '2';
      process.env.DM_APPEAL_DUR = '2';

      const getBlock = jest.fn().mockResolvedValue({ timestamp: now });
      await expect(
        handler.onDrafted(marketId, '0xOwner', ticketId, orderId, disputeId, { getBlock } as any),
      ).resolves.toBeUndefined();

      // Ticket should be updated correctly
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeTruthy();
      expect(ticket.orderId).toEqual(23);
      expect(ticket.draftedAt).toBeDefined();
      expect(ticket.disputeId).toEqual(2);

      // Draft record should be created
      const draft = await Draft.find({ ticketId: ticket.id });
      expect(draft.disputeId).toEqual(2);
      expect(draft).toBeDefined();

      // Dispute should be updated correctly
      const { DM_PREDICT_DUR, DM_APPEAL_DUR } = process.env;
      const unix = moment.unix;
      dispute = await Dispute.getById(dispute.id);
      expect(dispute.numMediatorsDrafted).toEqual(1);
      const evidEndAt = now + parseInt(process.env.DM_EVIDENCE_DUR);
      expect(unix(evidEndAt).isSame(dispute.evidenceEndAt)).toBeTruthy();
      const expectedCommitEndAt = evidEndAt + parseInt(DM_PREDICT_DUR) / 2;
      expect(unix(expectedCommitEndAt).isSame(dispute.commitEndAt)).toBeTruthy();
      expect(unix(evidEndAt + parseInt(DM_PREDICT_DUR)).isSame(dispute.predictEndAt)).toBeTruthy();
      const expectedAppealEndAt = evidEndAt + parseInt(DM_PREDICT_DUR) + parseInt(DM_APPEAL_DUR);
      expect(unix(expectedAppealEndAt).isSame(dispute.appealEndAt)).toBeTruthy();

      expect(mockNotify).toBeCalledTimes(6);

      // expect notification to be sent to drafted ticket owner
      expect(mockNotify).toHaveBeenNthCalledWith(1, NotifyType.TicketDrafted, net, '0xOwner', {
        marketId: '0xMarket',
        owner: '0xOwner',
        ticketId: 1,
        orderId: 23,
      });

      // expect FullyDrafted notification to be sent to swap participants
      const fullyDraftedLocal = {
        marketId,
        orderId: orderId.toNumber(),
        numDrafted: 1,
        disputeId: disputeId.toNumber(),
        pair: `${swap.base}/${swap.quote}`.toUpperCase(),
        evidencePhaseHoursLeft: moment(dispute.evidenceEndAt).fromNow(true),
      };
      expect(mockNotify).toHaveBeenNthCalledWith(
        2,
        NotifyType.FullyDrafted,
        net,
        swap.provider,
        fullyDraftedLocal,
      );
      expect(mockNotify).toHaveBeenNthCalledWith(
        3,
        NotifyType.FullyDrafted,
        net,
        swap.taker,
        fullyDraftedLocal,
      );

      // expect EvidencePhaseStarted notification to be sent to drafted
      // ticket owners
      expect(mockNotify).toHaveBeenNthCalledWith(
        4,
        NotifyType.EvidencePhaseStarted,
        net,
        '0xDraftOwner1',
        fullyDraftedLocal,
      );
      expect(mockNotify).toHaveBeenNthCalledWith(
        5,
        NotifyType.EvidencePhaseStarted,
        net,
        '0xDraftOwner2',
        fullyDraftedLocal,
      );
      expect(mockNotify).toHaveBeenNthCalledWith(
        6,
        NotifyType.EvidencePhaseStarted,
        net,
        '0xOwner',
        fullyDraftedLocal,
      );
    });
  });

  describe('.onUndrafted', () => {
    it('should un-mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
        orderId: 23,
        disputeId: 1,
      });
      await expect(
        handler.onUndrafted('0xMarket', '0xOwner', toBN(1), true, {} as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeFalsy();
      expect(ticket.draftedAt).toBeNull();
      expect(ticket.orderId).toEqual(23);
      expect(ticket.disputeId).toEqual(1);

      // not slashed
      await expect(
        handler.onUndrafted('0xMarket', '0xOwner', toBN(1), false, {} as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeFalsy();
      expect(ticket.draftedAt).toBeNull();
      expect(ticket.orderId).toBeNull();
      expect(ticket.disputeId).toBeNull();
    });
  });

  describe('.onTicketSlashed', () => {
    it('should mark ticket as slashed, update bond and add a slash record', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        marketId: '0xMarket',
        owner: '0xOwner',
        bond: toBN(20).toString(),
        orderId: 23,
      });

      mockGetContracts.mockReturnValue({ p2pToken: { decimals: jest.fn().mockResolvedValue(18) } });

      const now = moment().unix();
      await expect(
        handler.onTicketSlashed('0xOwner', toBN(1), '0xMarket', toBN(10), true, true, {
          getBlock: jest.fn().mockResolvedValue({ timestamp: now }),
        } as any),
      ).resolves.toBeUndefined();

      ticket = await Ticket.getById(ticket.id);
      expect(ticket.slashed).toBeTruthy();
      expect(ticket.bond).toEqual(toBN(10).toString());
      expect(ticket.marketId).toBeNull();
      expect(ticket.orderId).toBeNull();
      const expectedLeaveAt = moment.unix(now + parseInt(process.env.MM_TICKET_EXPIRE_DUR));
      expect(moment(ticket.joinBy).unix()).toEqual(expectedLeaveAt.unix());

      const slash = await TicketSlash.find({
        network: net,
        owner: '0xOwner',
        marketId: '0xMarket',
        index: 1,
      });
      expect(slash).toBeDefined();
      expect(slash.amount).toEqual(toBN(10).toString());
      expect(slash.voted).toBeTruthy();
      expect(slash.winSide).toBeTruthy();
      expect(slash.orderId).toEqual(23);

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.TicketSlashed, net, '0xOwner', {
        marketId: '0xMarket',
        owner: '0xOwner',
        ticketId: '1',
        orderId: '23',
        amount: '0.00000000000000001',
        asset: 'P2P',
        reason: 'VOTED WITH MINORITY',
      });
    });
  });
});

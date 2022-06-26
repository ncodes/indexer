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
      await Market.create({
        network: net,
        creator: '0xCreator',
        marketId: '0xMarket',
      });
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
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
      await Market.create({
        network: net,
        creator: '0xCreator',
        marketId: '0xMarket',
      });
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
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
      await expect(
        handler.onDrafted('0xMarket', '0xOwner', toBN(1), toBN(23), {} as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeTruthy();
      expect(ticket.orderId).toEqual(23);
      expect(ticket.draftedAt).toBeDefined();

      const draft = await Draft.find({ ticketId: ticket.id });
      expect(draft).toBeDefined();

      // expect notification to have been sent
      expect(mockNotify).toHaveBeenCalledWith(NotifyType.TicketDrafted, net, '0xOwner', {
        marketId: '0xMarket',
        owner: '0xOwner',
        ticketId: '1',
        orderId: '23',
      });
    });
  });

  describe('.onUndrafted', () => {
    it('should un-mark ticket as drafted', async () => {
      let ticket = await Ticket.create({
        network: net,
        index: 1,
        owner: '0xOwner',
        orderId: 23,
      });
      await expect(
        handler.onUndrafted('0xMarket', '0xOwner', toBN(1), {} as any),
      ).resolves.toBeUndefined();
      ticket = await Ticket.getById(ticket.id);
      expect(ticket.drafted).toBeFalsy();
      expect(ticket.draftedAt).toBeNull();
      expect(ticket.orderId).toEqual(23);
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

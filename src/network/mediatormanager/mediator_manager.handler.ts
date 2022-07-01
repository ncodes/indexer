import * as ethers from 'ethers';
import { Handler } from '../handler';
import { BigNumber } from 'ethers';
import { Transaction } from 'objection';
import Ticket from '../../models/ticket';
import * as moment from 'moment';
import { toBN } from '../common';
import TicketSlash from '../../models/ticket_slash';
import NetworkService from '../network.service';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';
import { commify, formatUnits } from 'ethers/lib/utils';
import Market from '../../models/market';
import Draft from '../../models/draft';

export class MediatorManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: ethers.providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
  ) {
    super(network, contracts.mediatorMgr);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'TicketPurchased',
      async (
        owner: string,
        id: BigNumber,
        amount: BigNumber,
        matureAt: BigNumber,
        joinBy: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onTicketPurchased(owner, id, amount, matureAt, joinBy, event, txn);
      },
    );

    this.on(
      'TicketCancelled',
      async (owner: string, id: BigNumber, event: ethers.Event, txn?: Transaction) => {
        return this.onTicketCancelled(owner, id, event, txn);
      },
    );

    this.on(
      'TicketDrained',
      async (
        owner: string,
        id: BigNumber,
        amount: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onTicketDrained(owner, id, amount, event, txn);
      },
    );

    this.on(
      'JoinedMarket',
      async (
        owner: string,
        marketId: string,
        ticketId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onJoinedMarket(owner, marketId, ticketId, event, txn);
      },
    );

    this.on(
      'LeftMarket',
      async (
        owner: string,
        marketId: string,
        ticketId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onLeftMarket(owner, marketId, ticketId, event, txn);
      },
    );

    this.on(
      'Drafted',
      async (
        marketId: string,
        owner: string,
        ticketId: BigNumber,
        orderId: BigNumber,
        disputeId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDrafted(marketId, owner, ticketId, orderId, disputeId, event, txn);
      },
    );

    this.on(
      'Undrafted',
      async (
        marketId: string,
        owner: string,
        ticketId: BigNumber,
        slashed: boolean,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onUndrafted(marketId, owner, ticketId, slashed, event, txn);
      },
    );

    this.on(
      'TicketSlashed',
      async (
        owner: string,
        ticketId: BigNumber,
        marketId: string,
        amount: BigNumber,
        voted: boolean,
        winSide: boolean,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onTicketSlashed(owner, ticketId, marketId, amount, voted, winSide, event, txn);
      },
    );
  }

  /**
   * A ticket was purchased
   * @param owner The address of the ticket purchaser
   * @param id The unique id of the ticket
   * @param amount The amount locked in the ticket
   * @param matureAt Ticket become matured after this time.
   * @param joinBy Ticket must join a market before this time or become expired.
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketPurchased(
    owner: string,
    id: BigNumber,
    amount: BigNumber,
    matureAt: BigNumber,
    joinBy: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Ticket.create(
      {
        network: this.network,
        owner,
        index: id.toNumber(),
        bond: amount.toString(),
        matureAt: moment.unix(matureAt.toNumber()).toISOString(),
        joinBy: moment.unix(joinBy.toNumber()).toISOString(),
        txHash: event.transactionHash,
      },
      txn,
    );
    return Promise.resolve();
  }

  /**
   * A ticket was cancelled
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketCancelled(owner: string, id: BigNumber, event: ethers.Event, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      id.toNumber(),
      undefined,
      txn,
    );
    const block = await event.getBlock();
    const cancelAt = block.timestamp + parseInt(process.env.MM_TICKET_CANCEL_DUR);
    await Ticket.updateById(ticket.id, { cancelAt: moment.unix(cancelAt).toISOString() }, txn);
    return Promise.resolve();
  }

  /**
   * A ticket was drained
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param amount The amount drained from the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketDrained(
    owner: string,
    id: BigNumber,
    amount: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      id.toNumber(),
      undefined,
      txn,
    );
    await Ticket.updateById(
      ticket.id,
      { bond: '0', drained: true, drainedAt: moment().toISOString() },
      txn,
    );
    return Promise.resolve();
  }

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onJoinedMarket(
    owner: string,
    marketId: string,
    ticketId: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      ticketId.toNumber(),
      undefined,
      txn,
    );
    const block = await event.getBlock();
    const leaveAt = block.timestamp + parseInt(process.env.MM_MIN_TICKET_TENURE_DUR);
    await Ticket.updateById(
      ticket.id,
      { marketId, leaveAt: moment.unix(leaveAt).toISOString() },
      txn,
    );

    // Send notification
    const numTickets = await Ticket.countByNetworkAndMarket(this.network, marketId, txn);
    const market = await Market.getMarket(this.network, marketId, undefined, txn);
    await this.notifSrv.notify(NotifyType.JoinedMarket, this.network, market.creator, {
      marketId,
      owner,
      numTickets,
    });

    return Promise.resolve();
  }

  /**
   * A ticket left a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onLeftMarket(
    owner: string,
    marketId: string,
    ticketId: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      ticketId.toNumber(),
      undefined,
      txn,
    );

    const block = await event.getBlock();
    const joinBy = block.timestamp + parseInt(process.env.MM_TICKET_EXPIRE_DUR);
    await Ticket.updateById(
      ticket.id,
      {
        marketId: null,
        leaveAt: null,
        joinBy: moment.unix(joinBy).toISOString(),
      },
      txn,
    );

    // Send notification
    const numTickets = await Ticket.countByNetworkAndMarket(this.network, marketId, txn);
    const market = await Market.getMarket(this.network, marketId, undefined, txn);
    await this.notifSrv.notify(NotifyType.LeftMarket, this.network, market.creator, {
      marketId,
      owner,
      numTickets,
    });

    return Promise.resolve();
  }

  /**
   * A ticket was drafted to mediate
   * @param marketId The ID of the market the ticket joined
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param orderId The ID of the order ticket was drafted to
   * @param disputeId The dispute ID
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onDrafted(
    marketId: string,
    owner: string,
    ticketId: BigNumber,
    orderId: BigNumber,
    disputeId: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      ticketId.toNumber(),
      undefined,
      txn,
    );
    await Ticket.updateById(
      ticket.id,
      {
        orderId: orderId.toNumber(),
        drafted: true,
        draftedAt: moment().toISOString(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );
    await Draft.create(
      {
        network: this.network,
        owner,
        index: ticketId.toNumber(),
        marketId,
        ticketId: ticket.id,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );

    // Send notification
    await this.notifSrv.notify(NotifyType.TicketDrafted, this.network, owner, {
      marketId,
      owner,
      ticketId: ticketId.toString(),
      orderId: orderId.toString(),
    });

    return Promise.resolve();
  }

  /**
   * A ticket was undrafted
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketId The ID of the market the ticket joined
   * @param slashed Indicates whether the ticket was slashed
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onUndrafted(
    marketId: string,
    owner: string,
    ticketId: BigNumber,
    slashed: boolean,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      ticketId.toNumber(),
      undefined,
      txn,
    );
    await Ticket.updateById(
      ticket.id,
      {
        orderId: slashed ? ticket.orderId : null,
        disputeId: slashed ? ticket.disputeId : null,
        drafted: false,
        draftedAt: null,
      },
      txn,
    );
    return Promise.resolve();
  }

  /**
   * A ticket was slashed
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketId The ID of the market the ticket joined
   * @param amount The amount that was slashed
   * @param voted Indicates whether the ticket voted
   * @param winSide Indicates whether the ticker was on the winning side
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketSlashed(
    owner: string,
    ticketId: BigNumber,
    marketId: string,
    amount: BigNumber,
    voted: boolean,
    winSide: boolean,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      this.network,
      owner,
      ticketId.toNumber(),
      undefined,
      txn,
    );

    const block = await event.getBlock();
    const joinBy = block.timestamp + parseInt(process.env.MM_TICKET_EXPIRE_DUR);
    await Ticket.updateById(
      ticket.id,
      {
        orderId: null,
        disputeId: null,
        slashed: true,
        bond: toBN(ticket.bond).sub(amount).toString(),
        joinBy: moment.unix(joinBy).toISOString(),
        marketId: null,
      },
      txn,
    );

    await TicketSlash.create(
      {
        network: ticket.network,
        owner: ticket.owner,
        index: ticket.index,
        marketId: ticket.marketId,
        ticketId: ticket.id,
        orderId: ticket.orderId,
        disputeId: ticket.disputeId,
        amount: amount.toString(),
        voted,
        winSide,
      },
      txn,
    );

    // Send notification
    const p2pDecimal = await this.netSrv.getContracts(this.network).p2pToken.decimals();
    await this.notifSrv.notify(NotifyType.TicketSlashed, this.network, owner, {
      marketId,
      owner,
      ticketId: ticketId.toString(),
      orderId: ticket.orderId.toString(),
      amount: commify(formatUnits(amount, p2pDecimal)),
      asset: 'P2P',
      reason: !voted ? 'DID NOT VOTE' : 'VOTED WITH MINORITY',
    });

    return Promise.resolve();
  }
}

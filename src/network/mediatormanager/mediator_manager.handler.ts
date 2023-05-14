import * as ethers from 'ethers';
import { BigNumber } from 'ethers';
import { Handler } from '../handler';
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
import Dispute from '../../models/dispute';
import Swap from '../../models/swap';
import MineTask, { MineTaskType } from '../../models/mine_task';

export class MediatorManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: ethers.providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(netSrv.cfgSrv, network, contracts.mediatorMgr);
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
        marketAddress: string,
        ticketId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onJoinedMarket(owner, marketAddress, ticketId, event, txn);
      },
    );

    this.on(
      'LeftMarket',
      async (
        owner: string,
        marketAddress: string,
        ticketId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onLeftMarket(owner, marketAddress, ticketId, event, txn);
      },
    );

    this.on(
      'Drafted',
      async (
        marketAddress: string,
        owner: string,
        ticketId: BigNumber,
        orderId: BigNumber,
        disputeId: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, event, txn);
      },
    );

    this.on(
      'Undrafted',
      async (
        marketAddress: string,
        owner: string,
        ticketId: BigNumber,
        slashed: boolean,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onUndrafted(marketAddress, owner, ticketId, slashed, event, txn);
      },
    );

    this.on(
      'TicketSlashed',
      async (
        owner: string,
        ticketId: BigNumber,
        marketAddress: string,
        amount: BigNumber,
        voted: boolean,
        winSide: boolean,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onTicketSlashed(
          owner,
          ticketId,
          marketAddress,
          amount,
          voted,
          winSide,
          event,
          txn,
        );
      },
    );

    this.on(
      'DelegatedAccount',
      async (
        owner: string,
        ticketId: BigNumber,
        delegate: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDelegatedAccount(owner, ticketId, delegate, event, txn);
      },
    );

    this.on(
      'UndelegatedAccount',
      async (
        owner: string,
        ticketId: BigNumber,
        delegate: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onUndelegatedAccount(owner, ticketId, delegate, event, txn);
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
    const cancelAt = block.timestamp + parseInt(this.getParam('ticketCancelDur'));
    await Ticket.updateById(ticket.id, { cancelAt: moment.unix(cancelAt).toISOString() }, txn);
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
  }

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param marketAddress The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onJoinedMarket(
    owner: string,
    marketAddress: string,
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
    const leaveAt = block.timestamp + parseInt(this.getParam('minTicketTenureDur'));
    await Ticket.updateById(
      ticket.id,
      { marketAddress, leaveAt: moment.unix(leaveAt).toISOString() },
      txn,
    );

    // Update market
    const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
    await Market.updateById(market.id, {
      totalJoinedMediatorsBond: toBN(market.totalJoinedMediatorsBond).add(ticket.bond).toString(),
      numMediatorsJoined: market.numMediatorsJoined + 1,
    });

    // Send notification
    const numTickets = await Ticket.countByNetworkAndMarket(this.network, marketAddress, txn);
    await this.notifSrv.notify(NotifyType.JoinedMarket, this.network, market.creator, {
      marketAddress,
      owner,
      numTickets,
    });
  }

  /**
   * A ticket left a market
   * @param owner The ticket owner
   * @param marketAddress The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onLeftMarket(
    owner: string,
    marketAddress: string,
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
    const joinBy = block.timestamp + parseInt(this.getParam('ticketExpireDur'));
    await Ticket.updateById(
      ticket.id,
      {
        marketAddress: null,
        leaveAt: null,
        joinBy: moment.unix(joinBy).toISOString(),
      },
      txn,
    );

    // Update market
    const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
    await Market.updateById(market.id, {
      totalJoinedMediatorsBond: toBN(market.totalJoinedMediatorsBond).sub(ticket.bond).toString(),
      numMediatorsJoined: market.numMediatorsJoined - 1,
    });

    // Send notification
    const numTickets = await Ticket.countByNetworkAndMarket(this.network, marketAddress, txn);
    await this.notifSrv.notify(NotifyType.LeftMarket, this.network, market.creator, {
      marketAddress,
      owner,
      numTickets,
    });
  }

  /**
   * A ticket was drafted to mediate
   * @param marketAddress The ID of the market the ticket joined
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param orderId The ID of the order ticket was drafted to
   * @param disputeId The dispute ID
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onDrafted(
    marketAddress: string,
    owner: string,
    ticketId: BigNumber,
    orderId: BigNumber,
    disputeId: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    // Update ticket status
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

    // Get the dispute
    let dispute = await Dispute.get(
      this.network,
      marketAddress,
      orderId.toNumber(),
      disputeId.toNumber(),
      txn,
    );

    // Create new draft
    await Draft.create(
      {
        network: this.network,
        owner,
        index: ticketId.toNumber(),
        marketAddress,
        ticketId: ticket.id,
        orderId: orderId.toNumber(),
        disputeIndex: disputeId.toNumber(),
        disputeId: dispute.id,
      },
      txn,
    );

    // Compute dispute phases times when dispute is fully drafted
    const numDrafted = dispute.numMediatorsDrafted + 1;
    const fullyDrafted = numDrafted >= dispute.numMediators;
    const block = await event.getBlock();
    const now = block.timestamp;
    const evidEndAt = fullyDrafted ? now + parseInt(this.getParam('evidenceDur')) : undefined;
    const commitEndAt = fullyDrafted
      ? evidEndAt + parseInt(this.getParam('predictDur')) / 2
      : undefined;
    const predictEndAt = fullyDrafted
      ? evidEndAt + parseInt(this.getParam('predictDur'))
      : undefined;
    const appealEndAt = fullyDrafted
      ? predictEndAt + parseInt(this.getParam('appealDur'))
      : undefined;
    dispute = await Dispute.updateById(
      dispute.id,
      {
        numMediatorsDrafted: numDrafted,
        evidenceEndAt: evidEndAt ? moment.unix(evidEndAt).toISOString() : undefined,
        commitEndAt: commitEndAt ? moment.unix(commitEndAt).toISOString() : undefined,
        predictEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
        revealEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
        appealEndAt: appealEndAt ? moment.unix(appealEndAt).toISOString() : undefined,
      },
      txn,
    );

    // Complete a draft mining task
    await MineTask.completeOneDraftTask(
      ticket.network,
      marketAddress,
      orderId.toNumber(),
      disputeId.toNumber(),
      txn,
    );

    // Create execution task when fully drafted
    if (fullyDrafted) {
      await MineTask.create(
        {
          type: MineTaskType.Execute,
          network: dispute.network,
          marketAddress,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
          mineAt: dispute.appealEndAt,
        },
        txn,
      );
    }

    // Send notification
    await this.notifSrv.notify(NotifyType.TicketDrafted, this.network, owner, {
      marketAddress,
      owner,
      ticketId: ticketId.toNumber(),
      orderId: orderId.toNumber(),
    });

    // Send notification to provider and taker when fully drafted
    if (fullyDrafted) {
      const swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
      const locals = {
        marketAddress,
        orderId: orderId.toNumber(),
        numDrafted,
        disputeId: disputeId.toNumber(),
        pair: `${swap.base}/${swap.quote}`.toUpperCase(),
        evidencePhaseHoursLeft: moment(dispute.evidenceEndAt).fromNow(true),
      };
      await this.notifSrv.notify(NotifyType.FullyDrafted, this.network, swap.provider, locals);
      await this.notifSrv.notify(NotifyType.FullyDrafted, this.network, swap.taker, locals);

      // Send notification to drafted mediators
      const drafted = await Draft.getAll(
        this.network,
        marketAddress,
        orderId.toNumber(),
        disputeId.toNumber(),
        txn,
      );
      for (const draft of drafted) {
        await this.notifSrv.notify(
          NotifyType.EvidencePhaseStarted,
          this.network,
          draft.owner,
          locals,
        );
      }
    }
  }

  /**
   * A ticket was undrafted
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketAddress The ID of the market the ticket joined
   * @param slashed Indicates whether the ticket was slashed
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onUndrafted(
    marketAddress: string,
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

    // Complete an undraft mining task
    await MineTask.completeOneUndraftTask(
      this.network,
      marketAddress,
      ticket.orderId,
      ticket.disputeId,
      txn,
    );

    // Note: You might think it is appropriate to set `orderId` and
    // `disputeId` to null, but do not. The next event (TicketSlashed)
    // after this will need the values and will be responsible for
    // resetting it
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
  }

  /**
   * A ticket was slashed
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketAddress The ID of the market the ticket joined
   * @param amount The amount that was slashed
   * @param voted Indicates whether the ticket voted
   * @param winSide Indicates whether the ticker was on the winning side
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketSlashed(
    owner: string,
    ticketId: BigNumber,
    marketAddress: string,
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
    const joinBy = block.timestamp + parseInt(this.getParam('ticketExpireDur'));
    await Ticket.updateById(
      ticket.id,
      {
        orderId: null,
        disputeId: null,
        slashed: true,
        bond: toBN(ticket.bond).sub(amount).toString(),
        joinBy: moment.unix(joinBy).toISOString(),
        marketAddress: null,
      },
      txn,
    );

    await TicketSlash.create(
      {
        network: ticket.network,
        owner: ticket.owner,
        index: ticket.index,
        marketAddress: ticket.marketAddress,
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
      marketAddress,
      owner,
      ticketId: ticketId.toString(),
      orderId: ticket.orderId.toString(),
      amount: commify(formatUnits(amount, p2pDecimal)),
      asset: 'P2P',
      reason: !voted ? 'DID NOT VOTE' : 'VOTED WITH MINORITY',
    });
  }

  /**
   * A ticket was delegated to another account
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param delegate The address of the new delegate
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onDelegatedAccount(
    owner: string,
    ticketId: BigNumber,
    delegate: string,
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
    await Ticket.create(
      {
        network: this.network,
        owner,
        index: ticket.index,
        bond: ticket.bond,
        matureAt: ticket.matureAt,
        joinBy: ticket.joinBy,
        delegated: true,
        delegate,
        txHash: event.transactionHash,
      },
      txn,
    );
  }

  /**
   * A delegate was un-delegated from a ticket
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param delegate The address of the delegate
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onUndelegatedAccount(
    owner: string,
    ticketId: BigNumber,
    delegate: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Ticket.removeDelegate(this.network, owner, ticketId.toNumber(), delegate, txn);
  }
}

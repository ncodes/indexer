import { Provider, formatEther } from 'ethers';
import * as moment from 'moment';
import { Transaction } from 'objection';
import { toDec } from '../../common/common';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import { NotificationID } from '../../jobs/notifications/common';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Event, { Events } from '../../models/event';
import Market from '../../models/market';
import Meta from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Swap from '../../models/swap';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import { ContractCallEvent, commify, getBlockTime, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class MediatorManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotificationService,
    private provider: Provider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(MediatorManagerHandler.name, netSrv.cfgSrv, network, contracts.mediatorMgr);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'TicketPurchased',
      async (
        owner: string,
        id: bigint,
        poolId: bigint,
        amount: bigint,
        matureAt: bigint,
        joinBy: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onTicketPurchased(owner, id, poolId, amount, matureAt, joinBy, event, txn);
      },
    );

    this.on('TicketCancelled', async (owner: string, id: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onTicketCancelled(owner, id, event, txn);
    });

    this.on(
      'TicketDrained',
      async (owner: string, id: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onTicketDrained(owner, id, amount, event, txn);
      },
    );

    this.on(
      'JoinedPool',
      async (owner: string, pooldId: bigint, ticketId: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onJoinedPool(owner, pooldId, ticketId, event, txn);
      },
    );

    this.on(
      'Drafted',
      async (
        marketAddress: string,
        owner: string,
        ticketId: bigint,
        orderId: bigint,
        disputeId: bigint,
        drafter: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, drafter, event, txn);
      },
    );

    this.on(
      'Undrafted',
      async (
        owner: string,
        ticketId: bigint,
        slashed: boolean,
        undrafter: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onUndrafted(owner, ticketId, slashed, undrafter, event, txn);
      },
    );

    this.on(
      'TicketSlashed',
      async (
        owner: string,
        ticketId: bigint,
        amount: bigint,
        voted: boolean,
        winSide: boolean,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onTicketSlashed(owner, ticketId, amount, voted, winSide, event, txn);
      },
    );

    this.on(
      'UpdatedTicketPool',
      async (
        poolId: bigint,
        reqBond: bigint,
        draftReward: bigint,
        winReward: bigint,
        noVoteSlashBP: bigint,
        loseVoteSlashBP: bigint,
        numDraftees: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onUpdatedTicketPool(
          poolId,
          reqBond,
          draftReward,
          winReward,
          noVoteSlashBP,
          loseVoteSlashBP,
          numDraftees,
          event,
          txn,
        );
      },
    );

    this.on('UpdatedTicketCancelDuration', async (duration: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('ticketCancelDur', duration.toString(), event, txn);
    });

    this.on('UpdatedTicketMatureDuration', async (duration: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('ticketMatureDur', duration.toString(), event, txn);
    });

    this.on('UpdatedTicketExpireDuration', async (duration: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('ticketExpireDur', duration.toString(), event, txn);
    });
  }

  /**
   * A ticket was purchased
   * @param owner The address of the ticket purchaser
   * @param id The unique id of the ticket
   * @param poolId The pool id of the ticket
   * @param amount The amount locked in the ticket
   * @param matureAt Ticket become matured after this time.
   * @param joinBy Ticket must join a market before this time or become expired.
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketPurchased(
    owner: string,
    id: bigint,
    poolId: bigint,
    amount: bigint,
    matureAt: bigint,
    joinBy: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Ticket.create(
      {
        network: this.network,
        owner,
        index: toNumber(id),
        poolId: toNumber(poolId),
        bond: amount.toString(),
        matureAt: moment.unix(toNumber(matureAt)).toISOString(),
        joinBy: moment.unix(toNumber(joinBy)).toISOString(),
        txHash: event.transactionHash,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('ticket:purchased', this.network, owner, event, txn);
  }

  /**
   * A ticket was cancelled
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketCancelled(owner: string, id: bigint, event: ContractCallEvent, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(id), undefined, txn);
    const blockTime = await getBlockTime(event);
    const cancelAt = blockTime + parseInt(await this.getParam('ticketCancelDur'));
    await Ticket.updateById(
      ticket.id,
      {
        cancelAt: moment.unix(cancelAt).toISOString(),
        joined: false,
        poolId: null,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('ticket:cancelled', this.network, owner, event, txn);
  }

  /**
   * A ticket was drained
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param _amount The amount drained from the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketDrained(owner: string, id: bigint, _amount: bigint, event: ContractCallEvent, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(id), undefined, txn);
    await Ticket.updateById(ticket.id, { bond: '0', drained: true, drainedAt: moment().toISOString() }, txn);
    await this.netSrv.pointSrv.grantPoint('ticket:drained', this.network, owner, event, txn);
  }

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param poolId The pool ID of the ticket
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onJoinedPool(owner: string, poolId: bigint, ticketId: bigint, event: ContractCallEvent, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(ticketId), undefined, txn);
    await Ticket.updateById(ticket.id, { poolId: toNumber(poolId), joined: true }, txn);
    await this.netSrv.pointSrv.grantPoint('ticket:joined', this.network, owner, event, txn);
  }

  /**
   * A ticket was drafted to mediate
   * @param marketAddress The ID of the market the ticket joined
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param orderId The ID of the order ticket was drafted to
   * @param disputeId The dispute ID
   * @param drafter The address if the drafter
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onDrafted(
    marketAddress: string,
    owner: string,
    ticketId: bigint,
    orderId: bigint,
    disputeId: bigint,
    drafter: string,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    // Update ticket status
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(ticketId), undefined, txn);
    await Ticket.updateById(
      ticket.id,
      {
        orderId: toNumber(orderId),
        drafted: true,
        draftedAt: moment().toISOString(),
        disputeId: toNumber(disputeId),
      },
      txn,
    );

    // Get the dispute
    let dispute = await Dispute.get(this.network, marketAddress, toNumber(orderId), toNumber(disputeId), txn);

    // Create new draft
    await Draft.create(
      {
        network: this.network,
        owner,
        index: toNumber(ticketId),
        marketAddress,
        ticketId: ticket.id,
        orderId: toNumber(orderId),
        disputeIndex: toNumber(disputeId),
        disputeId: dispute.id,
      },
      txn,
    );

    const market = await Market.getMarket(this.network, marketAddress);

    // Compute dispute phases times when dispute is fully drafted
    const evidenceDur = market.evidenceDur || parseInt(await this.getParam('evidenceDur'));
    const predictDur = market.predictDur || parseInt(await this.getParam('predictDur'));
    const numDrafted = dispute.numMediatorsDrafted + 1;
    const fullyDrafted = numDrafted >= dispute.numMediators;
    const blockTime = await getBlockTime(event);
    const evidenceEndAt = fullyDrafted ? blockTime + evidenceDur : undefined;
    const commitEndAt = fullyDrafted ? evidenceEndAt + predictDur / 2 : undefined;
    const predictEndAt = fullyDrafted ? evidenceEndAt + predictDur : undefined;
    dispute = await Dispute.updateById(
      dispute.id,
      {
        numMediatorsDrafted: numDrafted,
        evidenceEndAt: evidenceEndAt ? moment.unix(evidenceEndAt).toISOString() : undefined,
        commitEndAt: commitEndAt ? moment.unix(commitEndAt).toISOString() : undefined,
        predictEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
        revealEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
      },
      txn,
    );

    // Complete a draft mining task
    await MineTask.completeOneDraftTask(ticket.network, marketAddress, toNumber(orderId), toNumber(disputeId), txn);

    // Create execution task when fully drafted
    if (fullyDrafted) {
      if (!(await MineTask.taskExist(MineTaskType.Execute, this.network, dispute.orderId, dispute.disputeId, txn))) {
        await MineTask.create(
          {
            type: MineTaskType.Execute,
            network: dispute.network,
            marketAddress,
            orderId: toNumber(orderId),
            disputeId: toNumber(disputeId),
            mineAt: dispute.revealEndAt,
          },
          txn,
        );
      }
    }

    // Create swap event
    await Event.create({
      network: this.network,
      marketAddress,
      orderId: toNumber(orderId),
      creator: drafter,
      disputeId: toNumber(disputeId),
      draftee: owner,
      action: Events.SwapDrafted,
    });

    await this.netSrv.pointSrv.grantPoint('ticket:drafted', this.network, owner, event, txn);
    await this.netSrv.pointSrv.grantPoint('ticket:drafter', this.network, drafter, event, txn);

    // Send notification
    this.notifSrv.notify(NotificationID.TicketDrafted, this.network, owner, {
      owner,
      ticketId: toNumber(ticketId),
      dispute,
    });

    if (fullyDrafted) {
      // Send notification to provider and taker when fully drafted
      const swap = await Swap.get(this.network, toNumber(orderId), undefined, undefined, txn);
      const locals = { dispute, evidencePhaseHoursLeft: moment(dispute.evidenceEndAt).fromNow(true) };
      this.notifSrv.notify(NotificationID.FullyDrafted, this.network, swap.provider, locals);
      this.notifSrv.notify(NotificationID.FullyDrafted, this.network, swap.taker, locals);

      // Send notification to drafted mediators
      const drafted = await Draft.getAll(this.network, marketAddress, toNumber(orderId), toNumber(disputeId), txn);
      for (const draft of drafted) {
        this.notifSrv.notify(NotificationID.EvidencePhaseStarted, this.network, draft.owner, locals);
      }
    }
  }

  /**
   * A ticket was undrafted
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param slashed Indicates whether the ticket was slashed
   * @param undrafter The address of the caller
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onUndrafted(
    owner: string,
    ticketId: bigint,
    slashed: boolean,
    undrafter: string,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(ticketId), undefined, txn);
    const order = await Swap.get(this.network, ticket.orderId, undefined, undefined, txn);

    // Update dispute
    const dispute = await Dispute.get(order.network, order.marketAddress, order.orderId, ticket.disputeId, txn);
    await Dispute.updateById(dispute.id, { numMediatorsUndrafted: dispute.numMediatorsUndrafted + 1 }, txn);

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress: order.marketAddress,
        orderId: ticket.orderId,
        creator: undrafter,
        disputeId: ticket.disputeId,
        action: Events.SwapUndrafted,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('ticket:undrafted', this.network, owner, event, txn);
    await this.netSrv.pointSrv.grantPoint('ticket:undrafter', this.network, undrafter, event, txn);

    // Complete an undraft mining task
    await MineTask.completeOneUndraftTask(this.network, ticket.orderId, ticket.disputeId, txn);

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
   * @param amount The amount that was slashed
   * @param voted Indicates whether the ticket voted
   * @param winSide Indicates whether the ticker was on the winning side
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onTicketSlashed(
    owner: string,
    ticketId: bigint,
    amount: bigint,
    voted: boolean,
    winSide: boolean,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, toNumber(ticketId), undefined, txn);
    ticket = await Ticket.updateById(
      ticket.id,
      {
        orderId: null,
        disputeId: null,
        slashed: true,
        joined: false,
        poolId: null,
        bond: toDec(ticket.bond).sub(amount.toString()).toString(),
      },
      txn,
    );

    await TicketSlash.create(
      {
        network: ticket.network,
        owner: ticket.owner,
        index: ticket.index,
        poolId: ticket.poolId,
        ticketId: ticket.id,
        orderId: ticket.orderId,
        disputeId: ticket.disputeId,
        amount: amount.toString(),
        voted,
        winSide,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('ticket:slashed', this.network, owner, event, txn);

    // Send notification
    this.notifSrv.notify(NotificationID.TicketSlashed, this.network, owner, {
      ticket,
      owner,
      amount: commify(formatEther(amount)),
      voted,
      asset: 'P2P',
    });
  }

  /**
   * Ticket pool was updated
   * @param poolId The ID of the pool
   * @param reqBond The pool's required bond
   * @param draftReward The reward for drafted tickets
   * @param winReward The reward for winning tickets
   * @param noVoteSlashBP The slash BP for tickets that did not vote
   * @param loseVoteSlashBP The slash BP for tickets that voted for the losing side
   * @param numDraftees The number of draftees
   * @param _event The event object
   * @param txn The database transaction handle
   */
  async onUpdatedTicketPool(
    poolId: bigint,
    reqBond: bigint,
    draftReward: bigint,
    winReward: bigint,
    noVoteSlashBP: bigint,
    loseVoteSlashBP: bigint,
    numDraftees: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Meta.update(
      Meta.makeMediatorPoolKey(this.network, toNumber(poolId)),
      JSON.stringify(<PoolParams>{
        poolId: toNumber(poolId),
        reqBond: reqBond.toString(),
        draftReward: draftReward.toString(),
        winReward: winReward.toString(),
        noVoteSlashBP: noVoteSlashBP.toString(),
        loseVoteSlashBP: loseVoteSlashBP.toString(),
        numDraftees: toNumber(numDraftees),
      }),
      txn,
    );
  }

  /**
   * Updated a parameter
   * @param param The parameter name
   * @param value The updated value
   * @param _event The event object
   * @param txn The transaction object
   */
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: ContractCallEvent, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}

import * as ethers from 'ethers';
import { BigNumber } from 'ethers';
import { Handler } from '../handler';
import { Transaction } from 'objection';
import Ticket from '../../models/ticket';
import * as moment from 'moment';
import { toBN } from '../common';
import TicketSlash from '../../models/ticket_slash';
import NetworkService from '../network.service';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import { commify, formatEther } from 'ethers/lib/utils';
import Draft from '../../models/draft';
import Dispute from '../../models/dispute';
import Swap from '../../models/swap';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Meta from '../../models/meta';

export class MediatorManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: ethers.providers.JsonRpcProvider,
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
        id: BigNumber,
        poolId: BigNumber,
        amount: BigNumber,
        matureAt: BigNumber,
        joinBy: BigNumber,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onTicketPurchased(owner, id, poolId, amount, matureAt, joinBy, event, txn);
      },
    );

    this.on('TicketCancelled', async (owner: string, id: BigNumber, event: ethers.Event, txn?: Transaction) => {
      return this.onTicketCancelled(owner, id, event, txn);
    });

    this.on(
      'TicketDrained',
      async (owner: string, id: BigNumber, amount: BigNumber, event: ethers.Event, txn?: Transaction) => {
        return this.onTicketDrained(owner, id, amount, event, txn);
      },
    );

    this.on(
      'JoinedPool',
      async (owner: string, pooldId: BigNumber, ticketId: BigNumber, event: ethers.Event, txn?: Transaction) => {
        return this.onJoinedPool(owner, pooldId, ticketId, event, txn);
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
        drafter: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDrafted(marketAddress, owner, ticketId, orderId, disputeId, drafter, event, txn);
      },
    );

    this.on(
      'Undrafted',
      async (
        owner: string,
        ticketId: BigNumber,
        slashed: boolean,
        undrafter: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onUndrafted(owner, ticketId, slashed, undrafter, event, txn);
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
        return this.onTicketSlashed(owner, ticketId, marketAddress, amount, voted, winSide, event, txn);
      },
    );

    this.on(
      'UpdatedTicketPool',
      async (
        poolId: BigNumber,
        reqBond: BigNumber,
        draftReward: BigNumber,
        winReward: BigNumber,
        noVoteSlashBP: BigNumber,
        loseVoteSlashBP: BigNumber,
        numDraftees: BigNumber,
        event: ethers.Event,
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
    id: BigNumber,
    poolId: BigNumber,
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
        poolId: poolId.toNumber(),
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
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, id.toNumber(), undefined, txn);
    const block = await event.getBlock();
    const cancelAt = block.timestamp + parseInt(await this.getParam('ticketCancelDur'));
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
  async onTicketDrained(owner: string, id: BigNumber, amount: BigNumber, event: ethers.Event, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, id.toNumber(), undefined, txn);
    await Ticket.updateById(ticket.id, { bond: '0', drained: true, drainedAt: moment().toISOString() }, txn);
  }

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param poolId The pool ID of the ticket
   * @param ticketId The unique id of the ticket
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onJoinedPool(owner: string, poolId: BigNumber, ticketId: BigNumber, event: ethers.Event, txn?: Transaction) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, ticketId.toNumber(), undefined, txn);
    await Ticket.updateById(ticket.id, { poolId: poolId.toNumber(), joined: true }, txn);
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
    ticketId: BigNumber,
    orderId: BigNumber,
    disputeId: BigNumber,
    drafter: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    // Update ticket status
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, ticketId.toNumber(), undefined, txn);
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
    let dispute = await Dispute.get(this.network, marketAddress, orderId.toNumber(), disputeId.toNumber(), txn);

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
    const evidEndAt = fullyDrafted ? now + parseInt(await this.getParam('evidenceDur')) : undefined;
    const commitEndAt = fullyDrafted ? evidEndAt + parseInt(await this.getParam('predictDur')) / 2 : undefined;
    const predictEndAt = fullyDrafted ? evidEndAt + parseInt(await this.getParam('predictDur')) : undefined;
    dispute = await Dispute.updateById(
      dispute.id,
      {
        numMediatorsDrafted: numDrafted,
        evidenceEndAt: evidEndAt ? moment.unix(evidEndAt).toISOString() : undefined,
        commitEndAt: commitEndAt ? moment.unix(commitEndAt).toISOString() : undefined,
        predictEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
        revealEndAt: predictEndAt ? moment.unix(predictEndAt).toISOString() : undefined,
      },
      txn,
    );

    // Complete a draft mining task
    await MineTask.completeOneDraftTask(ticket.network, marketAddress, orderId.toNumber(), disputeId.toNumber(), txn);

    // Create execution task when fully drafted
    if (fullyDrafted) {
      await MineTask.create(
        {
          type: MineTaskType.Execute,
          network: dispute.network,
          marketAddress,
          orderId: orderId.toNumber(),
          disputeId: disputeId.toNumber(),
          mineAt: dispute.revealEndAt,
        },
        txn,
      );
    }

    // Send notification
    await this.notifSrv.notify(NotificationID.TicketDrafted, this.network, owner, {
      owner,
      ticketId: ticketId.toNumber(),
      dispute,
    });

    if (fullyDrafted) {
      // Send notification to provider and taker when fully drafted
      const swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
      const locals = { dispute, evidencePhaseHoursLeft: moment(dispute.evidenceEndAt).fromNow(true) };
      await this.notifSrv.notify(NotificationID.FullyDrafted, this.network, swap.provider, locals);
      await this.notifSrv.notify(NotificationID.FullyDrafted, this.network, swap.taker, locals);

      // Send notification to drafted mediators
      const drafted = await Draft.getAll(this.network, marketAddress, orderId.toNumber(), disputeId.toNumber(), txn);
      for (const draft of drafted) {
        await this.notifSrv.notify(NotificationID.EvidencePhaseStarted, this.network, draft.owner, locals);
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
    ticketId: BigNumber,
    slashed: boolean,
    undrafter: string,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, ticketId.toNumber(), undefined, txn);

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
    const block = await event.getBlock();
    const joinBy = block.timestamp + parseInt(await this.getParam('ticketExpireDur'));

    let ticket = await Ticket.getByNetworkOwnerAndIndex(this.network, owner, ticketId.toNumber(), undefined, txn);
    ticket = await Ticket.updateById(
      ticket.id,
      {
        orderId: null,
        disputeId: null,
        slashed: true,
        bond: toBN(ticket.bond).sub(amount).toString(),
        joinBy: moment.unix(joinBy).toISOString(),
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
    ),
      // Send notification
      await this.notifSrv.notify(NotificationID.TicketSlashed, this.network, owner, {
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
   * @param event The event object
   * @param txn The database transaction handle
   */
  async onUpdatedTicketPool(
    poolId: BigNumber,
    reqBond: BigNumber,
    draftReward: BigNumber,
    winReward: BigNumber,
    noVoteSlashBP: BigNumber,
    loseVoteSlashBP: BigNumber,
    numDraftees: BigNumber,
    event: ethers.Event,
    txn?: Transaction,
  ) {
    await Meta.update(
      Meta.makeMediatorPoolKey(this.network, poolId.toNumber()),
      JSON.stringify(<PoolParams>{
        poolId: poolId.toNumber(),
        reqBond: reqBond.toString(),
        draftReward: draftReward.toString(),
        winReward: winReward.toString(),
        noVoteSlashBP: noVoteSlashBP.toString(),
        loseVoteSlashBP: loseVoteSlashBP.toString(),
        numDraftees: numDraftees.toNumber(),
      }),
      txn,
    );
  }
}

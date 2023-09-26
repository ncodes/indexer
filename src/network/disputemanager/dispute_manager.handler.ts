import { BigNumber, ethers, Event as ChainEvent, providers } from 'ethers';
import { Handler } from '../handler';
import Swap from '../../models/swap';
import { Transaction } from 'objection';
import Dispute from '../../models/dispute';
import Market from '../../models/market';
import Commit from '../../models/commit';
import Reveal from '../../models/reveal';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import NetworkService from '../network.service';
import Draft from '../../models/draft';
import * as _ from 'lodash';
import { isEqualStr, toDec } from '../../common/common';
import Liquidity from '../../models/liquidity';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Meta from '../../models/meta';
import Event, { Events } from '../../models/event';

export class DisputeManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(DisputeManagerHandler.name, netSrv.cfgSrv, network, contracts.disputeMgr);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'DisputeCreated',
      async (
        orderId: BigNumber,
        creator: string,
        disputeId: BigNumber,
        wantRelease: boolean,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDisputeCreated(orderId, creator, disputeId, wantRelease, event, txn);
      },
    );

    this.on(
      'Committed',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        committer: string,
        ticketIdx: BigNumber,
        hash: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onCommitted(marketAddress, orderId, disputeId, committer, ticketIdx, hash, event, txn);
      },
    );

    this.on(
      'Revealed',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        revealer: string,
        ticketIdx: BigNumber,
        vote: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onRevealed(marketAddress, orderId, disputeId, revealer, ticketIdx, vote, event, txn);
      },
    );

    this.on(
      'DecisionExecuted',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        executor: string,
        abandoned: boolean,
        winningVote: string,
        event: ethers.Event,
      ) => {
        return this.onDecisionExecuted(marketAddress, orderId, disputeId, executor, abandoned, winningVote, event);
      },
    );
  }

  /**
   * A dispute was created
   * @param orderId The order ID
   * @param creator The address of the dispute creator
   * @param disputeId The dispute ID
   * @param wantRelease Indicate the creator wants dispute released
   * @param _event The event object
   * @param txn The transaction object
   */
  async onDisputeCreated(
    orderId: BigNumber,
    creator: string,
    disputeId: BigNumber,
    wantRelease: boolean,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    const swap = await Swap.get(this.network, orderId.toNumber(), undefined, undefined, txn);
    const { provider, marketAddress, taker, network, lid } = swap;

    // Calculate number of mediators required
    const market = await Market.getMarket(this.network, swap.marketAddress, undefined, undefined, txn);

    // Get pool info
    const poolParamKey = Meta.makeMediatorPoolKey(this.network, market.mediatorPoolId);
    const poolInfo = await Meta.getJSON<PoolParams>(poolParamKey, txn);

    // Get number of disputes (and re-disputes)
    const numDisp = await Dispute.countByNetworkAndMarketIdAndOrderId(
      swap.network,
      swap.marketAddress,
      swap.orderId,
      txn,
    );

    // Create a dispute
    const redispute = numDisp > 0;
    const dispute = await Dispute.create(
      {
        network: this.network,
        creator,
        defendant: provider === creator ? taker : provider,
        marketAddress: marketAddress,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
        wantRelease,
        redispute,
        numMediators: poolInfo.numDraftees,
      },
      txn,
    );

    // Create mediator draft task(s)
    Array(poolInfo.numDraftees)
      .fill(0)
      .map(async () => {
        await MineTask.create(
          {
            type: MineTaskType.Draft,
            network: network,
            marketAddress: marketAddress,
            orderId: orderId.toNumber(),
            disputeId: disputeId.toNumber(),
          },
          txn,
        );
      });

    // Update market
    let totalDisputes = !redispute ? market.totalDisputes + 1 : market.totalDisputes;
    await Market.updateById(
      market.id,
      {
        openDisputes: !redispute ? market.openDisputes + 1 : market.openDisputes,
        totalDisputes,
        disputeRate: !redispute ? toDec(totalDisputes).div(market.totalSwaps).mul(100).toNumber() : market.disputeRate,
      },
      txn,
    );

    // Update liquidity
    const liquidity = await Liquidity.getLiquidity(network, marketAddress, provider, lid, undefined, undefined, txn);
    totalDisputes = !redispute ? liquidity.totalDisputes + 1 : liquidity.totalDisputes;
    await Liquidity.updateById(
      liquidity.id,
      {
        openDisputes: !redispute ? liquidity.openDisputes + 1 : liquidity.openDisputes,
        totalDisputes,
        disputeRate: !redispute
          ? toDec(totalDisputes).div(liquidity.totalSwaps).mul(100).toNumber()
          : liquidity.disputeRate,
      },
      txn,
    );

    // Create swap event
    await Event.create({
      network: this.network,
      marketAddress,
      orderId: orderId.toNumber(),
      creator: creator,
      disputeId: disputeId.toNumber(),
      action: Events.SwapDisputed,
    });

    // Send notification;
    const recipient = isEqualStr(swap.provider, creator) ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotificationID.DisputeCreated, this.network, recipient, {
      dispute,
      swap,
    });
  }

  /**
   * A mediator committed a hash for a vote
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param committer The address of the mediator
   * @param ticketIdx The index of the ticket
   * @param hash The hash committed
   * @param _event The event object
   * @param txn The transaction object
   */
  async onCommitted(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    committer: string,
    ticketIdx: BigNumber,
    hash: string,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    await Commit.create(
      {
        network: this.network,
        marketAddress,
        committer,
        hash,
        ticketIndex: ticketIdx.toNumber(),
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );

    // Create swap event
    await Event.create({
      network: this.network,
      marketAddress,
      orderId: orderId.toNumber(),
      creator: committer,
      disputeId: disputeId.toNumber(),
      action: Events.SwapCommitted,
    });
  }

  /**
   * A mediator revealed a committed vote
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param revealer The address of the mediator
   * @param ticketIdx The index of the ticket
   * @param vote The revealed vote
   * @param _event The event object
   * @param txn The transaction object
   */
  async onRevealed(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    revealer: string,
    ticketIdx: BigNumber,
    vote: string,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    await Reveal.create(
      {
        network: this.network,
        marketAddress,
        revealer,
        vote,
        ticketIndex: ticketIdx.toNumber(),
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );

    // Create swap event
    await Event.create({
      network: this.network,
      marketAddress,
      orderId: orderId.toNumber(),
      creator: revealer,
      disputeId: disputeId.toNumber(),
      vote,
      action: Events.SwapRevealed,
    });
  }

  /**
   * A dispute outcome was executed
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param executor The address dispute outcome executed
   * @param abandoned Indicate the dispute was abandoned
   * @param winningVote The vote that was predicted by the majority.
   * @param _event The event object
   * @param txn The transaction object
   */
  async onDecisionExecuted(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    executor: string,
    abandoned: boolean,
    winningVote: string,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    let dispute = await Dispute.get(this.network, marketAddress, orderId.toNumber(), disputeId.toNumber(), txn);

    // Update dispute
    const stalled = !['0x30', '0x31'].includes(winningVote);
    dispute = await Dispute.updateById(
      dispute.id,
      { executed: true, released: !stalled ? winningVote === '0x31' : null, abandoned },
      txn,
    );

    // Update market
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    await Market.updateById(
      market.id,
      {
        openDisputes: !stalled || dispute.orderReleased ? market.openDisputes - 1 : market.openDisputes,
      },
      txn,
    );

    // Update liquidity
    const swap = await Swap.get(dispute.network, dispute.orderId, [], undefined, txn);
    const liquidity = await Liquidity.getLiquidity(
      swap.network,
      swap.marketAddress,
      swap.provider,
      swap.lid,
      undefined,
      undefined,
      txn,
    );
    await Liquidity.updateById(
      liquidity.id,
      {
        openDisputes: !stalled || dispute.orderReleased ? liquidity.openDisputes - 1 : liquidity.openDisputes,
      },
      txn,
    );

    // Create mediator undraft task(s)
    Array(dispute.numMediators)
      .fill(0)
      .map(async () => {
        await MineTask.create(
          {
            type: MineTaskType.Undraft,
            network: dispute.network,
            marketAddress: dispute.marketAddress,
            orderId: dispute.orderId,
            disputeId: dispute.disputeId,
          },
          txn,
        );
      });

    // Complete a dispute execution mining task
    await MineTask.completeOneExecutionTask(this.network, marketAddress, dispute.orderId, dispute.disputeId, txn);

    // Create swap event
    await Event.create({
      network: this.network,
      marketAddress,
      orderId: orderId.toNumber(),
      creator: executor,
      disputeId: disputeId.toNumber(),
      action: Events.SwapExecuted,
    });

    // Collate notification recipients
    const recipients: { address: string; drafted?: boolean }[] = [];

    // Send execution notice to provider and taker only if the dispute was not stalled
    if (!stalled) recipients.push({ address: swap.provider }, { address: swap.taker });

    // Get the drafted tickets
    const drafted = await Draft.getAll(swap.network, swap.marketAddress, swap.orderId, dispute.disputeId, txn);
    recipients.push(
      ..._.map(drafted, (v) => {
        return { address: v.owner, drafted: true };
      }),
    );

    // Send notification
    for (const recipient of recipients) {
      await this.notifSrv.notify(NotificationID.DisputeExecuted, swap.network, recipient.address, {
        swap,
        dispute,
        drafted: recipient.drafted,
      });
    }
  }
}

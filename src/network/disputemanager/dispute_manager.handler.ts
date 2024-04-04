import { Provider } from 'ethers';
import * as _ from 'lodash';
import { Transaction } from 'objection';
import { isEqualStr, toDec } from '../../common/common';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import { NotificationID } from '../../jobs/notifications/common';
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
import { ContractCallEvent, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class DisputeManagerHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotificationService,
    private provider: Provider,
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
        orderId: bigint,
        creator: string,
        disputeId: bigint,
        wantRelease: boolean,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onDisputeCreated(orderId, creator, disputeId, wantRelease, event, txn);
      },
    );

    this.on(
      'Committed',
      async (
        marketAddress: string,
        orderId: bigint,
        disputeId: bigint,
        committer: string,
        ticketIdx: bigint,
        hash: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onCommitted(marketAddress, orderId, disputeId, committer, ticketIdx, hash, event, txn);
      },
    );

    this.on(
      'Revealed',
      async (
        marketAddress: string,
        orderId: bigint,
        disputeId: bigint,
        revealer: string,
        ticketIdx: bigint,
        vote: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onRevealed(marketAddress, orderId, disputeId, revealer, ticketIdx, vote, event, txn);
      },
    );

    this.on(
      'DecisionExecuted',
      async (
        marketAddress: string,
        orderId: bigint,
        disputeId: bigint,
        executor: string,
        abandoned: boolean,
        winningVote: string,
        event: ContractCallEvent,
      ) => {
        return this.onDecisionExecuted(marketAddress, orderId, disputeId, executor, abandoned, winningVote, event);
      },
    );

    this.on('UpdatedPredictDur', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('predictDur', value.toString(), event, txn);
    });

    this.on('UpdatedEvidenceDur', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('evidenceDur', value.toString(), event, txn);
    });
  }

  /**
   * A dispute was created
   * @param orderId The order ID
   * @param creator The address of the dispute creator
   * @param disputeId The dispute ID
   * @param wantRelease Indicate the creator wants dispute released
   * @param event The event object
   * @param txn The transaction object
   */
  async onDisputeCreated(
    orderId: bigint,
    creator: string,
    disputeId: bigint,
    wantRelease: boolean,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const swap = await Swap.get(this.network, toNumber(orderId), undefined, undefined, txn);
    const { provider, marketAddress, taker, network, lid } = swap;

    // Calculate number of mediators required
    const market = await Market.getMarket(this.network, swap.marketAddress, undefined, undefined, true, txn);

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
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
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
            orderId: toNumber(orderId),
            disputeId: toNumber(disputeId),
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

    // Create a swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: toNumber(orderId),
        creator: creator,
        disputeId: toNumber(disputeId),
        action: Events.SwapDisputed,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('dispute:created', this.network, creator, event, txn);

    // Send notification;
    const recipient = isEqualStr(swap.provider, creator) ? swap.taker : swap.provider;
    this.notifSrv.notify(NotificationID.DisputeCreated, this.network, recipient, {
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
   * @param event The event object
   * @param txn The transaction object
   */
  async onCommitted(
    marketAddress: string,
    orderId: bigint,
    disputeId: bigint,
    committer: string,
    ticketIdx: bigint,
    hash: string,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Commit.create(
      {
        network: this.network,
        marketAddress,
        committer,
        hash,
        ticketIndex: toNumber(ticketIdx),
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
      },
      txn,
    );

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: toNumber(orderId),
        creator: committer,
        disputeId: toNumber(disputeId),
        action: Events.SwapCommitted,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('dispute:committed', this.network, committer, event, txn);
  }

  /**
   * A mediator revealed a committed vote
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param revealer The address of the mediator
   * @param ticketIdx The index of the ticket
   * @param vote The revealed vote
   * @param event The event object
   * @param txn The transaction object
   */
  async onRevealed(
    marketAddress: string,
    orderId: bigint,
    disputeId: bigint,
    revealer: string,
    ticketIdx: bigint,
    vote: string,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Reveal.create(
      {
        network: this.network,
        marketAddress,
        revealer,
        vote,
        ticketIndex: toNumber(ticketIdx),
        orderId: toNumber(orderId),
        disputeId: toNumber(disputeId),
      },
      txn,
    );

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: toNumber(orderId),
        creator: revealer,
        disputeId: toNumber(disputeId),
        vote,
        action: Events.SwapRevealed,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('dispute:revealed', this.network, revealer, event, txn);
  }

  /**
   * A dispute outcome was executed
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param executor The address dispute outcome executed
   * @param abandoned Indicate the dispute was abandoned
   * @param winningVote The vote that was predicted by the majority.
   * @param event The event object
   * @param txn The transaction object
   */
  async onDecisionExecuted(
    marketAddress: string,
    orderId: bigint,
    disputeId: bigint,
    executor: string,
    abandoned: boolean,
    winningVote: string,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let dispute = await Dispute.get(this.network, marketAddress, toNumber(orderId), toNumber(disputeId), txn);

    // Update dispute
    const stalled = !['0x30', '0x31'].includes(winningVote);
    dispute = await Dispute.updateById(
      dispute.id,
      { executed: true, released: !stalled ? winningVote === '0x31' : null, abandoned },
      txn,
    );

    // Update market
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
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

    // Create undraft task(s) for drafted mediators
    for (let i = 0; i < dispute.numMediatorsDrafted; i++) {
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
    }

    // Complete a dispute execution mining task
    await MineTask.completeOneExecutionTask(this.network, marketAddress, dispute.orderId, dispute.disputeId, txn);

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: toNumber(orderId),
        creator: executor,
        disputeId: toNumber(disputeId),
        action: Events.SwapExecuted,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('dispute:executed', this.network, executor, event, txn);

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
      this.notifSrv.notify(NotificationID.DisputeExecuted, swap.network, recipient.address, {
        swap,
        dispute,
        drafted: recipient.drafted,
      });
    }
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

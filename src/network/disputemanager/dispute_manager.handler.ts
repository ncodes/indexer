import { BigNumber, ethers, Event, providers } from 'ethers';
import { Handler } from '../handler';
import Swap from '../../models/swap';
import { Transaction } from 'objection';
import Dispute from '../../models/dispute';
import { toBN } from '../common';
import Market from '../../models/market';
import Commit from '../../models/commit';
import Reveal from '../../models/reveal';
import { NotifierService, NotificationID } from '../../jobs/mailer/NotifierService';
import NetworkService from '../network.service';
import Draft from '../../models/draft';
import * as _ from 'lodash';
import { toDec } from '../../common/common';
import Liquidity from '../../models/liquidity';
import MineTask, { MineTaskType } from '../../models/mine_task';

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
        wantRelease,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDisputeCreated(orderId, creator, disputeId, wantRelease, event, txn);
      },
    );

    this.on(
      'DraftedMediator',
      async (
        marketAddress: string,
        orderId: BigNumber,
        ticketOwner: string,
        ticketId: BigNumber,
        drafter: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onDraftedMediator(marketAddress, orderId, ticketOwner, ticketId, drafter, event, txn);
      },
    );

    this.on(
      'Committed',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        committer: string,
        hash: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onCommitted(marketAddress, orderId, disputeId, committer, hash, event, txn);
      },
    );

    this.on(
      'Revealed',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        revealer: string,
        vote: string,
        event: ethers.Event,
        txn?: Transaction,
      ) => {
        return this.onRevealed(marketAddress, orderId, disputeId, revealer, vote, event, txn);
      },
    );

    this.on('WithdrawnReward', (claimer: string, amount: BigNumber, event: ethers.Event, txn?: Transaction) => {
      return this.onWithdrawnReward(claimer, amount, event, txn);
    });

    this.on(
      'DecisionExecuted',
      async (
        marketAddress: string,
        orderId: BigNumber,
        disputeId: BigNumber,
        executor: string,
        abandoned: boolean,
        winningVote: string,
        execReward: BigNumber,
        event: ethers.Event,
      ) => {
        return this.onDecisionExecuted(
          marketAddress,
          orderId,
          disputeId,
          executor,
          abandoned,
          winningVote,
          execReward,
          event,
        );
      },
    );
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
    orderId: BigNumber,
    creator: string,
    disputeId: BigNumber,
    wantRelease: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    const swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
    const numDisp = await Dispute.countByNetworkAndMarketIdAndOrderId(
      swap.network,
      swap.marketAddress,
      swap.orderId,
      txn,
    );

    // Calculate number of mediators required
    const market = await Market.getMarket(this.network, swap.marketAddress, undefined, txn);
    const numMediators = Math.min(
      market.numMediators * (parseInt(numDisp) + 1),
      Math.min(parseInt(this.getParam('maxMediatorPerDispute'))),
    );

    // Create dispute
    const appeal = parseInt(numDisp) > 0;
    const dispute = await Dispute.create(
      {
        network: this.network,
        creator,
        defendant: swap.provider === creator ? swap.taker : swap.provider,
        marketAddress: swap.marketAddress,
        orderId: swap.orderId,
        disputeId: disputeId.toNumber(),
        wantRelease,
        appeal,
        deposit: toBN(this.getParam('disputeCost')).mul(numDisp).toString(),
        numMediators,
      },
      txn,
    );

    // Create mediator draft task(s)
    Array(numMediators)
      .fill(0)
      .map(async () => {
        await MineTask.create(
          {
            type: MineTaskType.Draft,
            network: swap.network,
            marketAddress: swap.marketAddress,
            orderId: swap.orderId,
            disputeId: disputeId.toNumber(),
          },
          txn,
        );
      });

    // Update market
    let totalDisputes = !appeal ? market.totalDisputes + 1 : market.totalDisputes;
    await Market.updateById(
      market.id,
      {
        openDisputes: !appeal ? market.openDisputes + 1 : market.openDisputes,
        totalDisputes,
        disputeRate: !appeal ? toDec(totalDisputes).div(market.totalSwaps).mul(100).toNumber() : market.disputeRate,
      },
      txn,
    );

    // Update liquidity
    const liquidity = await Liquidity.getLiquidity(
      swap.network,
      swap.marketAddress,
      swap.provider,
      undefined,
      undefined,
      txn,
    );
    totalDisputes = !appeal ? liquidity.totalDisputes + 1 : liquidity.totalDisputes;
    await Liquidity.updateById(
      liquidity.id,
      {
        openDisputes: !appeal ? liquidity.openDisputes + 1 : liquidity.openDisputes,
        totalDisputes,
        disputeRate: !appeal
          ? toDec(totalDisputes).div(liquidity.totalSwaps).mul(100).toNumber()
          : liquidity.disputeRate,
      },
      txn,
    );

    // Send notification
    const locals = {
      orderId: orderId.toNumber(),
      wantRelease,
      creator,
      appeal: dispute.appeal,
      pair: `${swap.base}/${swap.quote}`.toUpperCase(),
    };
    const recipient = swap.provider === creator ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotificationID.DisputeCreated, this.network, recipient, locals);
  }

  /**
   * A mediator was drafted
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param ticketOwner The drafted mediator's address
   * @param ticketId The ticket ID
   * @param drafter The address of the drafter
   * @param event The event object
   * @param txn The transaction object
   */
  async onDraftedMediator(
    marketAddress: string,
    orderId: BigNumber,
    ticketOwner: string,
    ticketId: BigNumber,
    drafter: string,
    event: Event,
    txn?: Transaction,
  ) {
    //
  }

  /**
   * A mediator committed a hash for a vote
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param committer The address of the mediator
   * @param hash The hash committed
   * @param event The event object
   * @param txn The transaction object
   */
  async onCommitted(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    committer: string,
    hash: string,
    event: Event,
    txn?: Transaction,
  ) {
    await Commit.create(
      {
        network: this.network,
        marketAddress,
        committer,
        hash,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );
  }

  /**
   * A mediator revealed a committed vote
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param revealer The address of the mediator
   * @param vote The revealed vote
   * @param event The event object
   * @param txn The transaction object
   */
  async onRevealed(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    revealer: string,
    vote: string,
    event: Event,
    txn?: Transaction,
  ) {
    await Reveal.create(
      {
        network: this.network,
        marketAddress,
        revealer,
        vote,
        orderId: orderId.toNumber(),
        disputeId: disputeId.toNumber(),
      },
      txn,
    );
  }

  /**
   * Some reward was withdrawn
   * @param claimer The address of the withdrawer
   * @param amount The amount withdrawn
   * @param event The event object
   * @param txn The transaction object
   */
  async onWithdrawnReward(claimer: string, amount: BigNumber, event: Event, txn?: Transaction) {
    //
  }

  /**
   * A dispute outcome was executed
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param executor The address dispute outcome executed
   * @param abandoned Indicate the dispute was abandoned
   * @param winningVote The vote that was predicted by the majority.
   * @param execReward The reward paid to the executor.
   * @param event The event object
   * @param txn The transaction object
   */
  async onDecisionExecuted(
    marketAddress: string,
    orderId: BigNumber,
    disputeId: BigNumber,
    executor: string,
    abandoned: boolean,
    winningVote: string,
    execReward: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    let dispute = await Dispute.get(this.network, marketAddress, orderId.toNumber(), disputeId.toNumber(), txn);

    // Update dispute
    const stalled = !['0x30', '0x31'].includes(winningVote);
    dispute = await Dispute.updateById(
      dispute.id,
      {
        executed: true,
        released: !stalled ? winningVote === '0x31' : null,
        abandoned,
      },
      txn,
    );

    // Update market
    const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
    await Market.updateById(market.id, { openDisputes: !stalled ? market.openDisputes - 1 : market.openDisputes }, txn);

    // Update liquidity
    const swap = await Swap.get(dispute.network, dispute.orderId, [], txn);
    const liquidity = await Liquidity.getLiquidity(
      swap.network,
      swap.marketAddress,
      swap.provider,
      undefined,
      undefined,
      txn,
    );
    await Liquidity.updateById(
      liquidity.id,
      {
        openDisputes: !stalled ? liquidity.openDisputes - 1 : liquidity.openDisputes,
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

    // Collate notification recipients
    const recipients: { address: string; drafted?: boolean }[] = [];
    recipients.push({ address: swap.provider }, { address: swap.taker });

    // Get the drafted tickets
    const drafted = await Draft.getAll(swap.network, swap.marketAddress, swap.orderId, dispute.disputeId);
    recipients.push(
      ..._.map(drafted, (v) => {
        return { address: v.owner, drafted: true };
      }),
    );

    // Send notification
    const { released } = dispute;
    for (const recipient of recipients) {
      await this.notifSrv.notify(NotificationID.DisputeExecuted, swap.network, recipient.address, {
        marketAddress: swap.marketAddress,
        network: swap.network,
        orderId: swap.orderId,
        disputeId: dispute.disputeId,
        drafted: recipient.drafted,
        pair: swap.getPair(),
        outcome: released === null ? 'Stalled' : released ? 'Release' : 'Cancel',
      });
    }
  }
}

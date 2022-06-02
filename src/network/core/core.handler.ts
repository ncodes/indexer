import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import { Handler } from '../handler';
import { ToDec } from './../../common/common';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
  ) {
    super(network);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.core,
      'SwapOrderPaid',
      (id: string, orderId: BigNumber, paidAt: BigNumber, event: Event) => {
        this.onSwapOrderPaid(id, orderId, paidAt, event);
      },
    );

    this.on(
      this.contracts.core,
      'RewardWithdrawn',
      (claimer: string, amount: BigNumber, event: Event) => {
        this.onRewardWithdrawn(claimer, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'OrderCancelled',
      (
        orderId: BigNumber,
        canceller: string,
        byDispute: boolean,
        event: Event,
      ) => {
        this.onOrderCancelled(orderId, canceller, byDispute, event);
      },
    );

    this.on(
      this.contracts.core,
      'SentFeeToFeeSharer',
      (token: string, amount: BigNumber, event: Event) => {
        this.onSentFeeToFeeSharer(token, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'ProtocolFeeUpdated',
      (
        instantSwapFee: BigNumber,
        p2pSwapFee: BigNumber,
        stableSwapFee: BigNumber,
        event: Event,
      ) => {
        this.onProtocolFeeUpdated(
          instantSwapFee,
          p2pSwapFee,
          stableSwapFee,
          event,
        );
      },
    );

    this.on(
      this.contracts.core,
      'UpdatedShareableAsset',
      (assets: string[], deleted: boolean, event: Event) => {
        this.onUpdatedShareableAsset(assets, deleted, event);
      },
    );

    this.on(
      this.contracts.core,
      'UpdatedLiquidity',
      (
        sender: string,
        marketId: string,
        deduction: boolean,
        amount: BigNumber,
        event: Event,
      ) => {
        this.onUpdatedLiquidity(sender, marketId, deduction, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'UpdatedPrice',
      (marketId: string, provider: string, manager: string, event: Event) => {
        this.onUpdatedPrice(marketId, provider, manager, event);
      },
    );

    this.on(
      this.contracts.core,
      'TogglePause',
      (marketId: string, provider: string, paused: boolean, event: Event) => {
        this.onTogglePause(marketId, provider, paused, event);
      },
    );

    this.on(
      this.contracts.core,
      'SetLiquidityManager',
      (marketId: string, provider: string, manager: string, event: Event) => {
        this.onSetLiquidityManager(marketId, provider, manager, event);
      },
    );

    this.on(
      this.contracts.core,
      'RemoveLiquidityManager',
      (marketId: string, provider: string, manager: string, event: Event) => {
        this.onRemoveLiquidityManager(marketId, provider, manager, event);
      },
    );
  }

  /**
   * An order was marked as `paid`
   * @param id The market ID
   * @param orderId The order ID
   * @param paidAt The timestamp when the payment was made.
   * @param event The event object
   */
  async onSwapOrderPaid(
    id: string,
    orderId: BigNumber,
    paidAt: BigNumber,
    event: Event,
  ) {}

  /**
   * Some reward was claimed
   * @param claimer The address that claimed the reward
   * @param amount The amount of reward claimed
   * @param event The event object
   */
  async onRewardWithdrawn(claimer: string, amount: BigNumber, event: Event) {}

  /**
   * An order was cancelled
   * @param orderId The order ID
   * @param canceller The address that cancelled the order
   * @param byDispute Indicates the order was cancelled by dispute resolution
   * @param event The event object
   */
  async onOrderCancelled(
    orderId: BigNumber,
    canceller: string,
    byDispute: boolean,
    event: Event,
  ) {}

  /**
   * Some fee was sent to the fee sharer contract
   * @param token The token address whose fee was transferred
   * @param amount The amount that was transferred
   * @param event The event object
   */
  async onSentFeeToFeeSharer(token: string, amount: BigNumber, event: Event) {}

  /**
   * The protocol fees was updated
   * @param instantSwapFee The new instant swap fee
   * @param p2pSwapFee The new p2p swap fee
   * @param stableSwapFee The new stable asset swap fee
   * @param event The event object
   */
  async onProtocolFeeUpdated(
    instantSwapFee: BigNumber,
    p2pSwapFee: BigNumber,
    stableSwapFee: BigNumber,
    event: Event,
  ) {}

  /**
   * The shareable asset index was updated
   * @param assets The list of asset addresses
   * @param deleted Indicates whether the assets where added or deleted
   * @param event The event object
   */
  async onUpdatedShareableAsset(
    assets: string[],
    deleted: boolean,
    event: Event,
  ) {}

  /**
   * Market liquidity was updated
   * @param sender The liquidity owner address
   * @param marketId The market ID
   * @param deduction Indicates whether the update was a deduction or addition
   * @param amount The amount that was added or deducted
   * @param event The event object
   */
  async onUpdatedLiquidity(
    sender: string,
    marketId: string,
    deduction: boolean,
    amount: BigNumber,
    event: Event,
  ) {
    this.logger.log(`Liquidity Updated by account:${sender}`);
    const liq = await this.contracts.core.getLiquidity(
      Buffer.from(marketId.substring(2), 'hex'),
      sender,
    );

    return transaction(Liquidity, async (Liquidity) => {
      const dbLiq = await Liquidity.getLiquidity(
        this.network,
        marketId,
        sender,
      );

      if (!dbLiq) {
        await Liquidity.create({
          network: this.network,
          provider: sender,
          marketId,
          amount: amount.toString(),
          price: liq.price.toString(),
          minSwap: liq.minSwap.toString(),
          maxSwap: liq.maxSwap.toString(),
          timeToPay: liq.timeToPay.toNumber(),
          openOrders: liq.openOrders.toNumber(),
          paused: liq.paused,
          blockNumber: event.blockNumber,
          blockHash: event.blockHash,
        });
      } else {
        const update = {
          price: liq.price.toString(),
          minSwap: liq.minSwap.toString(),
          maxSwap: liq.maxSwap.toString(),
          timeToPay: liq.timeToPay.toNumber(),
          amount: '0',
        };
        if (!deduction) {
          update.amount = ToDec(dbLiq.amount).add(amount.toString()).toFixed();
          await Liquidity.updateById(dbLiq.id, update);
        } else {
          update.amount = ToDec(dbLiq.amount).sub(amount.toString()).toFixed();
          await Liquidity.updateById(dbLiq.id, update);
        }
      }

      return Promise.resolve();
    });
  }

  /**
   * A market manager updated a liquidity's price
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The liquidity manager's address
   * @param event The event object
   */
  async onUpdatedPrice(
    marketId: string,
    provider: string,
    manager: string,
    event: Event,
  ) {}

  /**
   * A liquidity pause status was updated
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param paused Indicates whether the liquidity has been paused or unpaused
   * @param event The event object
   */
  async onTogglePause(
    marketId: string,
    provider: string,
    paused: boolean,
    event: Event,
  ) {}

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   */
  async onSetLiquidityManager(
    marketId: string,
    provider: string,
    manager: string,
    event: Event,
  ) {}

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   */
  async onRemoveLiquidityManager(
    marketId: string,
    provider: string,
    manager: string,
    event: Event,
  ) {}
}

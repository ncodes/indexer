import * as ethers from 'ethers';
import { Handler } from './handler';

export class CoreHandler extends Handler {
  constructor(private contracts: KnownContracts) {
    super();
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.core,
      'SwapOrderPaid',
      (id: string, orderId: number, paidAt: number, event: ethers.Event) => {
        this.onSwapOrderPaid(id, orderId, paidAt, event);
      },
    );

    this.on(
      this.contracts.core,
      'RewardWithdrawn',
      (claimer: string, amount: number, event: ethers.Event) => {
        this.onRewardWithdrawn(claimer, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'OrderCancelled',
      (
        orderId: number,
        canceller: string,
        byDispute: boolean,
        event: ethers.Event,
      ) => {
        this.onOrderCancelled(orderId, canceller, byDispute, event);
      },
    );

    this.on(
      this.contracts.core,
      'SentFeeToFeeSharer',
      (token: string, amount: number, event: ethers.Event) => {
        this.onSentFeeToFeeSharer(token, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'ProtocolFeeUpdated',
      (
        instantSwapFee: number,
        p2pSwapFee: number,
        stableSwapFee: number,
        event: ethers.Event,
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
      (assets: string[], deleted: boolean, event: ethers.Event) => {
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
        amount: number,
        event: ethers.Event,
      ) => {
        this.onUpdatedLiquidity(sender, marketId, deduction, amount, event);
      },
    );

    this.on(
      this.contracts.core,
      'UpdatedPrice',
      (
        marketId: string,
        provider: string,
        manager: string,
        event: ethers.Event,
      ) => {
        this.onUpdatedPrice(marketId, provider, manager, event);
      },
    );

    this.on(
      this.contracts.core,
      'TogglePause',
      (
        marketId: string,
        provider: string,
        paused: boolean,
        event: ethers.Event,
      ) => {
        this.onTogglePause(marketId, provider, paused, event);
      },
    );

    this.on(
      this.contracts.core,
      'SetLiquidityManager',
      (
        marketId: string,
        provider: string,
        manager: string,
        event: ethers.Event,
      ) => {
        this.onSetLiquidityManager(marketId, provider, manager, event);
      },
    );

    this.on(
      this.contracts.core,
      'RemoveLiquidityManager',
      (
        marketId: string,
        provider: string,
        manager: string,
        event: ethers.Event,
      ) => {
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
    orderId: number,
    paidAt: number,
    event: ethers.Event,
  ) {}

  /**
   * Some reward was claimed
   * @param claimer The address that claimed the reward
   * @param amount The amount of reward claimed
   * @param event The event object
   */
  async onRewardWithdrawn(
    claimer: string,
    amount: number,
    event: ethers.Event,
  ) {}

  /**
   * An order was cancelled
   * @param orderId The order ID
   * @param canceller The address that cancelled the order
   * @param byDispute Indicates the order was cancelled by dispute resolution
   * @param event The event object
   */
  async onOrderCancelled(
    orderId: number,
    canceller: string,
    byDispute: boolean,
    event: ethers.Event,
  ) {}

  /**
   * Some fee was sent to the fee sharer contract
   * @param token The token address whose fee was transferred
   * @param amount The amount that was transferred
   * @param event The event object
   */
  async onSentFeeToFeeSharer(
    token: string,
    amount: number,
    event: ethers.Event,
  ) {}

  /**
   * The protocol fees was updated
   * @param instantSwapFee The new instant swap fee
   * @param p2pSwapFee The new p2p swap fee
   * @param stableSwapFee The new stable asset swap fee
   * @param event The event object
   */
  async onProtocolFeeUpdated(
    instantSwapFee: number,
    p2pSwapFee: number,
    stableSwapFee: number,
    event: ethers.Event,
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
    event: ethers.Event,
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
    amount: number,
    event: ethers.Event,
  ) {}

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
    event: ethers.Event,
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
    event: ethers.Event,
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
    event: ethers.Event,
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
    event: ethers.Event,
  ) {}
}

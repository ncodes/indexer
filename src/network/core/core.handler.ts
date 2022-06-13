import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import { Handler } from '../handler';
import { ToDec } from '../../common/common';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
  ) {
    super(network, contracts.core);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'SwapOrderPaid',
      async (id: string, orderId: BigNumber, paidAt: BigNumber, event: Event) => {
        return this.onSwapOrderPaid(id, orderId, paidAt, event);
      },
    );

    this.on('RewardWithdrawn', async (claimer: string, amount: BigNumber, event: Event) => {
      return this.onRewardWithdrawn(claimer, amount, event);
    });

    this.on(
      'OrderCancelled',
      async (orderId: BigNumber, canceller: string, byDispute: boolean, event: Event) => {
        return this.onOrderCancelled(orderId, canceller, byDispute, event);
      },
    );

    this.on('SentFeeToFeeSharer', async (token: string, amount: BigNumber, event: Event) => {
      return this.onSentFeeToFeeSharer(token, amount, event);
    });

    this.on(
      'ProtocolFeeUpdated',
      async (
        instantSwapFee: BigNumber,
        p2pSwapFee: BigNumber,
        stableSwapFee: BigNumber,
        event: Event,
      ) => {
        return this.onProtocolFeeUpdated(instantSwapFee, p2pSwapFee, stableSwapFee, event);
      },
    );

    this.on('UpdatedShareableAsset', async (assets: string[], deleted: boolean, event: Event) => {
      return this.onUpdatedShareableAsset(assets, deleted, event);
    });

    this.on(
      'UpdatedLiquidity',
      async (
        sender: string,
        marketId: string,
        deduction: boolean,
        amount: BigNumber,
        price: BigNumber,
        minSwap: BigNumber,
        maxSwap: BigNumber,
        timeToPay: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onUpdatedLiquidity(
          sender,
          marketId,
          deduction,
          amount,
          price,
          minSwap,
          maxSwap,
          timeToPay,
          event,
          txn,
        );
      },
    );

    this.on(
      'UpdatedPrice',
      async (
        marketId: string,
        provider: string,
        manager: string,
        price: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onUpdatedPrice(marketId, provider, manager, price, event, txn);
      },
    );

    this.on(
      'TogglePause',
      async (marketId: string, provider: string, paused: boolean, event: Event) => {
        return this.onTogglePause(marketId, provider, paused, event);
      },
    );

    this.on(
      'SetLiquidityManager',
      async (marketId: string, provider: string, manager: string, event: Event) => {
        return this.onSetLiquidityManager(marketId, provider, manager, event);
      },
    );

    this.on(
      'RemoveLiquidityManager',
      async (marketId: string, provider: string, manager: string, event: Event) => {
        return this.onRemoveLiquidityManager(marketId, provider, manager, event);
      },
    );
  }

  /**
   * An order was marked as `paid`
   * @param id The market ID
   * @param orderId The order ID
   * @param paidAt The timestamp when the payment was made.
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrderPaid(
    id: string,
    orderId: BigNumber,
    paidAt: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {}

  /**
   * Some reward was claimed
   * @param claimer The address that claimed the reward
   * @param amount The amount of reward claimed
   * @param event The event object
   * @param txn The transaction object
   */
  async onRewardWithdrawn(claimer: string, amount: BigNumber, event: Event, txn?: Transaction) {}

  /**
   * An order was cancelled
   * @param orderId The order ID
   * @param canceller The address that cancelled the order
   * @param byDispute Indicates the order was cancelled by dispute resolution
   * @param event The event object
   * @param txn The transaction object
   */
  async onOrderCancelled(
    orderId: BigNumber,
    canceller: string,
    byDispute: boolean,
    event: Event,
    txn?: Transaction,
  ) {}

  /**
   * Some fee was sent to the fee sharer contract
   * @param token The token address whose fee was transferred
   * @param amount The amount that was transferred
   * @param event The event object
   * @param txn The transaction object
   */
  async onSentFeeToFeeSharer(token: string, amount: BigNumber, event: Event, txn?: Transaction) {}

  /**
   * The protocol fees was updated
   * @param instantSwapFee The new instant swap fee
   * @param p2pSwapFee The new p2p swap fee
   * @param stableSwapFee The new stable asset swap fee
   * @param event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeUpdated(
    instantSwapFee: BigNumber,
    p2pSwapFee: BigNumber,
    stableSwapFee: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {}

  /**
   * The shareable asset index was updated
   * @param assets The list of asset addresses
   * @param deleted Indicates whether the assets where added or deleted
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedShareableAsset(
    assets: string[],
    deleted: boolean,
    event: Event,
    txn?: Transaction,
  ) {}

  /**
   * Market liquidity was updated
   * @param provider The liquidity owner address
   * @param marketId The market ID
   * @param deduction Indicates whether the update was a deduction or addition
   * @param amount The amount that was added or deducted
   * @param price The latest price
   * @param minSwap The latest minimum swap amount
   * @param maxSwap The latest maximum swap amount
   * @param timeToPay The number of seconds within which payment must be received
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedLiquidity(
    provider: string,
    marketId: string,
    deduction: boolean,
    amount: BigNumber,
    price: BigNumber,
    minSwap: BigNumber,
    maxSwap: BigNumber,
    timeToPay: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    this.logger.log(`UpdatedLiquidity: processing...`);

    // Get existing liquidity by the provider
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);

    // Create the liquidity on database if not existing.
    // Otherwise, update the existing liquidity.
    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketId,
          amount: amount.toString(),
          price: price.toString(),
          minSwap: minSwap.toString(),
          maxSwap: maxSwap.toString(),
          timeToPay: timeToPay.toNumber(),
        },
        txn,
      );
    } else {
      const ch: any = {};
      if (liq.price !== price.toString()) ch.price = price.toString();
      if (liq.minSwap !== minSwap.toString()) ch.minSwap = minSwap.toString();
      if (liq.maxSwap !== maxSwap.toString()) ch.maxSwap = maxSwap.toString();
      if (liq.timeToPay !== timeToPay.toNumber()) ch.timeToPay = timeToPay.toNumber();
      if (!amount.isZero()) {
        ch.amount = deduction
          ? ToDec(liq.amount).sub(amount.toString()).toFixed()
          : ToDec(liq.amount).add(amount.toString()).toFixed();
      }
      await Liquidity.updateById(liq.id, ch);
    }

    // Add new market price entry
    await MarketPrice.create(
      {
        network: this.network,
        marketId,
        price: await Liquidity.getLowestPriceInMarket(this.network, marketId, txn),
      },
      txn,
    );

    return Promise.resolve();
  }

  /**
   * A market manager updated a liquidity's price
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The liquidity manager's address
   * @param price
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedPrice(
    marketId: string,
    provider: string,
    manager: string,
    price: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    // Get local liquidity
    const dbLiq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);
    if (!dbLiq) throw new Error('unexpected error: liquidity not found locally');

    // Update liquidity price
    await Liquidity.updateById(dbLiq.id, { price: price.toString() }, txn);

    // Add new market price entry
    await MarketPrice.create(
      {
        network: this.network,
        marketId,
        price: await Liquidity.getLowestPriceInMarket(this.network, marketId, txn),
      },
      txn,
    );
  }

  /**
   * A liquidity pause status was updated
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param paused Indicates whether the liquidity has been paused or unpaused
   * @param event The event object
   * @param txn The transaction object
   */
  async onTogglePause(
    marketId: string,
    provider: string,
    paused: boolean,
    event: Event,
    txn?: Transaction,
  ) {}

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onSetLiquidityManager(
    marketId: string,
    provider: string,
    manager: string,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);
    if (liq) {
      await Liquidity.updateById(liq.id, { manager }, txn);
      await this.notifSrv.notify(NotifyType.NewLiquidityManager, this.network, manager, {
        marketId,
        provider,
      });
    }
    return Promise.resolve(undefined);
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity providers's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onRemoveLiquidityManager(
    marketId: string,
    provider: string,
    manager: string,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);
    if (liq) {
      await Liquidity.updateById(liq.id, { manager: null }, txn);
      await this.notifSrv.notify(NotifyType.RemoveLiquidityManager, this.network, manager, {
        marketId,
        provider,
      });
    }
    return Promise.resolve(undefined);
  }
}

import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import { Handler } from '../handler';
import { ToDec } from '../../common/common';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';
import Swap from '../../models/swaps';
import Meta from '../../models/meta';
import NetworkService from '../network.service';
import Market from '../../models/market';
import { commify, formatUnits } from 'ethers/lib/utils';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private netSrv: NetworkService,
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
      'SwapOrder',
      async (
        marketId: string,
        provider: string,
        sender: string,
        orderId: BigNumber,
        amount: BigNumber,
        price: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSwapOrder(marketId, provider, sender, orderId, amount, price, event, txn);
      },
    );

    this.on(
      'Swap',
      async (
        marketId: string,
        orderId: BigNumber,
        provider: string,
        swapper: string,
        amount: BigNumber,
        price: BigNumber,
        byDispute: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSwap(
          marketId,
          orderId,
          provider,
          swapper,
          amount,
          price,
          byDispute,
          event,
          txn,
        );
      },
    );

    this.on(
      'OrderCancelled',
      async (
        orderId: BigNumber,
        canceller: string,
        byDispute: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onOrderCancelled(orderId, canceller, byDispute, event, txn);
      },
    );

    this.on(
      'SwapOrderPaid',
      async (
        id: string,
        orderId: BigNumber,
        paidAt: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSwapOrderPaid(id, orderId, paidAt, event, txn);
      },
    );

    this.on(
      'RewardWithdrawn',
      async (claimer: string, amount: BigNumber, event: Event, txn?: Transaction) => {
        return this.onRewardWithdrawn(claimer, amount, event, txn);
      },
    );

    this.on(
      'SentFeeToFeeSharer',
      async (token: string, amount: BigNumber, event: Event, txn?: Transaction) => {
        return this.onSentFeeToFeeSharer(token, amount, event, txn);
      },
    );

    this.on(
      'ProtocolFeeUpdated',
      async (
        instantSwapFee: BigNumber,
        p2pSwapFee: BigNumber,
        stableSwapFee: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onProtocolFeeUpdated(instantSwapFee, p2pSwapFee, stableSwapFee, event, txn);
      },
    );

    this.on(
      'UpdatedShareableAsset',
      async (assets: string[], deleted: boolean, event: Event, txn?: Transaction) => {
        return this.onUpdatedShareableAsset(assets, deleted, event, txn);
      },
    );

    this.on('RegStableAsset', async (address: string, event: Event, txn?: Transaction) => {
      return this.onRegStableAsset(address, event, txn);
    });

    this.on('VerifiedAsset', async (address: string, event: Event, txn?: Transaction) => {
      return this.onVerifiedAsset(address, event, txn);
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
      async (
        marketId: string,
        provider: string,
        paused: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onTogglePause(marketId, provider, paused, event, txn);
      },
    );

    this.on(
      'SetLiquidityManager',
      async (
        marketId: string,
        provider: string,
        manager: string,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSetLiquidityManager(marketId, provider, manager, event, txn);
      },
    );

    this.on(
      'RemoveLiquidityManager',
      async (
        marketId: string,
        provider: string,
        manager: string,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onRemoveLiquidityManager(marketId, provider, manager, event, txn);
      },
    );
  }

  /**
   * Handle new swap order
   * @param marketId The market ID
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param orderId The new order ID (non-zero)
   * @param amount The amount of liquidity ordered
   * @param price The price to pay per 1 liquidity asset unit
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrder(
    marketId: string,
    provider: string,
    swapper: string,
    orderId: BigNumber,
    amount: BigNumber,
    price: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    const market = await Market.getMarket(this.network, marketId, undefined, txn);
    const swap = {
      network: this.network,
      marketId,
      provider,
      taker: swapper,
      base: market.base,
      baseAddress: market.baseAddress,
      quote: market.quote,
      quoteAddress: market.quoteAddress,
      orderId: orderId.toNumber(),
      amount: amount.toString(),
      price: price.toString(),
    };
    const info = await this.netSrv.getSwapFeeInfo(this.provider, swap as Swap);
    await Swap.create({ ...swap, ...info }, txn);

    // Update liquidity open orders
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);
    await Liquidity.updateById(liq.id, {
      openOrders: liq.openOrders + 1,
      amount: BigNumber.from(liq.amount).sub(amount).toString(),
    });

    // Send notification
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    await this.notifSrv.notify(NotifyType.NewOffChainSwap, this.network, provider, {
      marketId,
      provider,
      orderId: swap.orderId,
      base: market.base,
      quote: market.quote,
      isBaseLocal: market.isBaseLocal,
      amount: commify(formatUnits(swap.amount, baseDecimal)),
      cost: commify(formatUnits(info.cost, quoteDecimal)),
    });

    return Promise.resolve();
  }

  /**
   * Handle new complete swap
   * @param marketId The market ID
   * @param orderId The new order ID (non-zero)
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param amount The amount of liquidity ordered
   * @param price The price to pay per 1 liquidity asset unit
   * @param byDispute Indicates whether the order was released by dispute
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwap(
    marketId: string,
    orderId: BigNumber,
    provider: string,
    swapper: string,
    amount: BigNumber,
    price: BigNumber,
    byDispute: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    if (orderId.isZero()) {
      const market = await Market.getMarket(this.network, marketId, undefined, txn);
      const swap = {
        network: this.network,
        marketId,
        provider,
        taker: swapper,
        base: market.base,
        baseAddress: market.baseAddress,
        quote: market.quote,
        quoteAddress: market.quoteAddress,
        orderId: !orderId.isZero() ? orderId.toNumber() - 1 : undefined,
        amount: amount.toString(),
        price: price.toString(),
        instant: orderId.isZero(),
        paid: orderId.isZero(),
        released: orderId.isZero(),
        cost: '',
      };
      const info = await this.netSrv.getSwapFeeInfo(this.provider, swap as Swap);
      await Swap.create({ ...swap, ...info }, txn);

      // Reduce open order count and amount of liquidity
      const liq = await Liquidity.getLiquidity(this.network, swap.marketId, swap.provider, txn);
      await Liquidity.updateById(liq.id, {
        amount: BigNumber.from(liq.amount).sub(amount).toString(),
      });

      // Send notification
      const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
      const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
      await this.notifSrv.notify(NotifyType.NewInstantSwap, this.network, provider, {
        marketId,
        base: market.base,
        quote: market.quote,
        amount: commify(formatUnits(swap.amount, baseDecimal)),
        cost: commify(formatUnits(info.cost, quoteDecimal)),
        provider,
      });
    } else {
      // Mark swap order as `released`
      const swap = await Swap.getByOrderId(orderId.toNumber() - 1, txn);
      await Swap.updateById(swap.id, { released: true }, txn);

      // Reduce open order count of liquidity
      const liq = await Liquidity.getLiquidity(this.network, swap.marketId, swap.provider, txn);
      await Liquidity.updateById(liq.id, { openOrders: liq.openOrders - 1 });

      // Send notification
      const market = await Market.getMarket(this.network, marketId, undefined, txn);
      const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
      const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
      const taker = !market.isBaseLocal ? provider : swapper;
      await this.notifSrv.notify(NotifyType.SwapOrderReleased, this.network, taker, {
        marketId,
        orderId: orderId.toNumber() - 1,
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: commify(formatUnits(swap.amount, baseDecimal)),
        cost: commify(formatUnits(swap.cost, quoteDecimal)),
      });
    }
    return Promise.resolve();
  }

  /**
   * Handle order cancellation
   * @param orderId The new order ID (non-zero)
   * @param canceller The order canceller's address
   * @param byDispute Indicates whether the order was cancelled by dispute
   * @param event The event object
   * @param txn The transaction object
   */
  async onOrderCancelled(
    orderId: BigNumber,
    canceller: string,
    byDispute: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    // Mark swap order as `cancelled`
    const swap = await Swap.getByOrderId(orderId.toNumber());
    await Swap.updateById(swap.id, { cancelled: true, byDispute }, txn);

    // Reduce open order count and liquidity
    const liq = await Liquidity.getLiquidity(this.network, swap.marketId, swap.provider, txn);
    await Liquidity.updateById(liq.id, {
      openOrders: liq.openOrders - 1,
      amount: BigNumber.from(liq.amount).add(swap.amount).toString(),
    });

    // Send notification
    const market = await Market.getMarket(this.network, swap.marketId, undefined, txn);
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    const recipient = swap.provider === canceller ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotifyType.SwapOrderCancelled, this.network, recipient, {
      marketId: swap.marketId,
      orderId: orderId.toNumber(),
      base: market.base,
      quote: market.quote,
      byDispute,
      amount: commify(formatUnits(swap.amount, baseDecimal)),
      cost: commify(formatUnits(swap.cost, quoteDecimal)),
    });

    return Promise.resolve();
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
  ) {
    await Swap.updateByOrderId(orderId.toNumber(), { paid: true }, txn);

    // Send notification
    const swap = await Swap.getByOrderId(orderId.toNumber(), txn);
    const market = await Market.getMarket(this.network, swap.marketId, undefined, txn);
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    const recipient = !market.isBaseLocal ? swap.provider : swap.taker;
    await this.notifSrv.notify(NotifyType.SwapOrderPaid, this.network, recipient, {
      marketId: swap.marketId,
      orderId: orderId.toNumber(),
      base: market.base,
      quote: market.quote,
      amount: commify(formatUnits(swap.amount, baseDecimal)),
      cost: commify(formatUnits(swap.cost, quoteDecimal)),
    });

    return Promise.resolve();
  }

  /**
   * Some reward was claimed
   * @param claimer The address that claimed the reward
   * @param amount The amount of reward claimed
   * @param event The event object
   * @param txn The transaction object
   */
  async onRewardWithdrawn(claimer: string, amount: BigNumber, event: Event, txn?: Transaction) {}

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
  ) {
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, 'instantSwapFee'),
      instantSwapFee.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, 'p2pSwapFee'),
      p2pSwapFee.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, 'stableSwapFee'),
      stableSwapFee.toString(),
      txn,
    );
    return Promise.resolve();
  }

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
  ) {
    const key = Meta.makeSharableAssetsKey(this.network);
    const existing = await Meta.get(key, txn);
    let shareable: any = {};
    if (existing) shareable = JSON.parse(existing.value);
    assets.forEach((asset) => {
      if (deleted) {
        delete shareable[asset];
      } else {
        shareable[asset] = 1;
      }
    });
    return await Meta.update(key, JSON.stringify(shareable), txn);
  }

  /**
   * A new asset was marked as a stable asset
   * @param address The asset address
   * @param event The event object
   * @param txn The transaction object
   */
  async onRegStableAsset(address: string, event: Event, txn?: Transaction) {
    const key = Meta.makeStableAssetsKey(this.network);
    const existing = await Meta.get(key, txn);
    let stable: any = {};
    if (existing) stable = JSON.parse(existing.value);
    stable[address] = 1;
    return await Meta.update(key, JSON.stringify(stable), txn);
  }

  /**
   * A new asset was verified for reward sharing
   * @param address The asset address
   * @param event The event object
   * @param txn The transaction object
   */
  async onVerifiedAsset(address: string, event: Event, txn?: Transaction) {
    const key = Meta.makeVerifiedAssetsKey(this.network);
    const existing = await Meta.get(key, txn);
    let verified: any = {};
    if (existing) verified = JSON.parse(existing.value);
    verified[address] = 1;
    return await Meta.update(key, JSON.stringify(verified), txn);
  }

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
    // Get existing liquidity by the provider
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);

    // Create the liquidity on database if not existing.
    // Otherwise, update the existing liquidity.
    if (!liq) {
      const market = await Market.getMarket(this.network, marketId);
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketId,
          base: market.base,
          baseAddress: market.baseAddress,
          quote: market.quote,
          quoteAddress: market.quoteAddress,
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
        provider,
        price: await Liquidity.getLowestPriceInMarket(this.network, marketId, txn),
      },
      txn,
    );

    return Promise.resolve();
  }

  /**
   * A market manager updated a liquidity's price
   * @param marketId The market ID
   * @param provider The liquidity provider's address
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
    if (!dbLiq) throw new Error('liquidity not found');

    // Update liquidity price
    await Liquidity.updateById(dbLiq.id, { price: price.toString() }, txn);

    // Add new market price entry
    await MarketPrice.create(
      {
        network: this.network,
        marketId,
        provider,
        price: await Liquidity.getLowestPriceInMarket(this.network, marketId, txn),
      },
      txn,
    );

    return Promise.resolve();
  }

  /**
   * A liquidity pause status was updated
   * @param marketId The market ID
   * @param provider The liquidity provider's address
   * @param paused Indicates whether the liquidity has been paused or un-paused
   * @param event The event object
   * @param txn The transaction object
   */
  async onTogglePause(
    marketId: string,
    provider: string,
    paused: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketId, provider, txn);
    await Liquidity.updateById(liq.id, { paused });
    return Promise.resolve(undefined);
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity provider's address
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
    await Liquidity.updateById(liq.id, { manager }, txn);
    await this.notifSrv.notify(NotifyType.NewLiquidityManager, this.network, manager, {
      marketId,
      provider,
    });
    return Promise.resolve(undefined);
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketId The market ID
   * @param provider The liquidity provider's address
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

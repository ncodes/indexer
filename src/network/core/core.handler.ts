import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import { Handler } from '../handler';
import { ToDec } from '../../common/common';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';
import Swap from '../../models/swap';
import Meta, { FeeName } from '../../models/meta';
import NetworkService from '../network.service';
import Market from '../../models/market';
import { commify, formatUnits } from 'ethers/lib/utils';
import * as moment from 'moment';
import { toBN } from '../common';
import Dispute from '../../models/dispute';
import MineTask, { MineTaskType } from '../../models/mine_task';
import User from '../../models/user';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(netSrv.cfgSrv, network, contracts.core);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'SwapOrder',
      async (
        marketAddress: string,
        provider: string,
        sender: string,
        orderId: BigNumber,
        amount: BigNumber,
        price: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSwapOrder(
          marketAddress,
          provider,
          sender,
          orderId,
          amount,
          price,
          event,
          txn,
        );
      },
    );

    this.on(
      'Swap',
      async (
        marketAddress: string,
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
          marketAddress,
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
      'TransferredToFeePool',
      async (token: string, amount: BigNumber, event: Event, txn?: Transaction) => {
        return this.onTransferredToFeePool(token, amount, event, txn);
      },
    );

    this.on(
      'ProtocolFeeUpdated',
      async (
        instantSwapFeeBp: BigNumber,
        syntheticSwapFeeBp: BigNumber,
        stableSwapFeeBp: BigNumber,
        fixedSynthSwapFee: BigNumber,
        fixedNFTSwapFee: BigNumber,
        instantNFTSwapFeeBp: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onProtocolFeeUpdated(
          instantSwapFeeBp,
          syntheticSwapFeeBp,
          stableSwapFeeBp,
          fixedSynthSwapFee,
          fixedNFTSwapFee,
          instantNFTSwapFeeBp,
          event,
          txn,
        );
      },
    );

    this.on(
      'UpdatedLiquidity',
      async (
        sender: string,
        marketAddress: string,
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
          marketAddress,
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
        marketAddress: string,
        provider: string,
        manager: string,
        price: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onUpdatedPrice(marketAddress, provider, manager, price, event, txn);
      },
    );

    this.on(
      'TogglePause',
      async (
        marketAddress: string,
        provider: string,
        paused: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onTogglePause(marketAddress, provider, paused, event, txn);
      },
    );

    this.on(
      'SetLiquidityManager',
      async (
        marketAddress: string,
        provider: string,
        manager: string,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onSetLiquidityManager(marketAddress, provider, manager, event, txn);
      },
    );

    this.on(
      'RemoveLiquidityManager',
      async (
        marketAddress: string,
        provider: string,
        manager: string,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onRemoveLiquidityManager(marketAddress, provider, manager, event, txn);
      },
    );
  }

  /**
   * Handle new swap order
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param orderId The new order ID (non-zero)
   * @param amount The amount of liquidity ordered
   * @param price The price to pay per 1 liquidity asset unit
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrder(
    marketAddress: string,
    provider: string,
    swapper: string,
    orderId: BigNumber,
    amount: BigNumber,
    price: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
    const swap = {
      network: this.network,
      marketAddress,
      provider,
      taker: swapper,
      base: market.base,
      baseAddress: market.baseAddress,
      quote: market.quote,
      quoteAddress: market.quoteAddress,
      orderId: orderId.toNumber(),
      amount: amount.toString(),
      price: price.toString(),
      txHash: event.transactionHash,
    };
    const info = await this.netSrv.getSwapFeeInfo(this.provider, swap as Swap);
    await Swap.create({ ...swap, ...info }, txn);

    // Update liquidity
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);
    await Liquidity.updateById(
      liq.id,
      {
        openOrders: liq.openOrders + 1,
        amount: toBN(liq.amount).sub(amount).toString(),
        totalSwaps: liq.totalSwaps + 1,
      },
      txn,
    );

    // Update market
    await Market.updateById(market.id, { totalSwaps: market.totalSwaps + 1 }, txn);

    // Send notification
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    await this.notifSrv.notify(NotifyType.NewOffChainSwap, this.network, provider, {
      marketAddress,
      provider,
      orderId: swap.orderId,
      base: market.base,
      quote: market.quote,
      baseType: market.baseType,
      amount: commify(formatUnits(swap.amount, baseDecimal)),
      cost: commify(formatUnits(info.cost, quoteDecimal)),
    });

    return Promise.resolve();
  }

  /**
   * Handle new complete swap
   * @param marketAddress The market ID
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
    marketAddress: string,
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
      const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
      const swap = {
        network: this.network,
        marketAddress,
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
        txHash: event.transactionHash,
      };
      const info = await this.netSrv.getSwapFeeInfo(this.provider, swap as Swap);
      await Swap.create({ ...swap, ...info }, txn);

      // Update liquidity
      const liq = await Liquidity.getLiquidity(
        this.network,
        swap.marketAddress,
        swap.provider,
        undefined,
        txn,
      );
      const now = moment().toISOString();
      await Liquidity.updateById(
        liq.id,
        {
          amount: toBN(liq.amount).sub(amount).toString(),
          amountSwapped: toBN(liq.amountSwapped).add(amount).toString(),
          lastSwapAt: now,
          totalSwaps: liq.totalSwaps + 1,
        },
        txn,
      );

      // Update market
      await Market.updateById(
        market.id,
        {
          lastSwapAt: now,
          amountSwapped: toBN(market.amountSwapped).add(amount).toString(),
          totalSwaps: market.totalSwaps + 1,
        },
        txn,
      );

      // Send notification
      const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
      const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
      await this.notifSrv.notify(NotifyType.NewInstantSwap, this.network, provider, {
        marketAddress,
        base: market.base,
        quote: market.quote,
        amount: commify(formatUnits(swap.amount, baseDecimal)),
        cost: commify(formatUnits(info.cost, quoteDecimal)),
        provider,
      });
    } else {
      // Mark swap order as `released`
      const swap = await Swap.get(this.network, orderId.toNumber() - 1, undefined, txn);
      await Swap.updateById(swap.id, { released: true }, txn);
      const { marketAddress, provider, cost } = swap;

      // Mark the last dispute as `orderReleased` if there is any
      const dispute = await Dispute.getRecentOfOrder(
        this.network,
        marketAddress,
        orderId.toNumber() - 1,
        txn,
      );
      if (dispute) {
        await Dispute.updateById(dispute.id, { orderReleased: true }, txn);
      }

      // Update liquidity
      const liq = await Liquidity.getLiquidity(
        this.network,
        marketAddress,
        provider,
        undefined,
        txn,
      );
      const now = moment();
      await Liquidity.updateById(
        liq.id,
        {
          openOrders: liq.openOrders - 1,
          lastSwapAt: now.toISOString(),
          amountSwapped: toBN(liq.amountSwapped).add(amount).toString(),
          completionRate: dispute
            ? liq.completionRate
            : await Swap.getCompletionRate(this.network, marketAddress, provider, txn),
        },
        txn,
      );

      // Update market
      const market = await Market.getMarket(this.network, marketAddress, undefined, txn);
      await Market.updateById(
        market.id,
        {
          lastSwapAt: now.toISOString(),
          amountSwapped: toBN(market.amountSwapped).add(amount).toString(),
          completionRate: dispute
            ? market.completionRate
            : await Swap.getCompletionRate(this.network, marketAddress, undefined, txn),
        },
        txn,
      );

      // Send notification
      const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
      const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
      const recipient = swap.getPayer();
      await this.notifSrv.notify(NotifyType.SwapOrderReleased, this.network, recipient, {
        marketAddress,
        orderId: orderId.toNumber() - 1,
        base: market.base,
        quote: market.quote,
        byDispute,
        amount: commify(formatUnits(amount, baseDecimal)),
        cost: commify(formatUnits(cost, quoteDecimal)),
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
    const swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
    await Swap.updateById(swap.id, { cancelled: true, byDispute }, txn);

    // Reduce open order count and liquidity
    const liq = await Liquidity.getLiquidity(
      this.network,
      swap.marketAddress,
      swap.provider,
      undefined,
      txn,
    );
    await Liquidity.updateById(liq.id, {
      openOrders: liq.openOrders - 1,
      amount: toBN(liq.amount).add(swap.amount).toString(),
    });

    // Send notification
    const market = await Market.getMarket(this.network, swap.marketAddress, undefined, txn);
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    const recipient = swap.provider === canceller ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotifyType.SwapOrderCancelled, this.network, recipient, {
      marketAddress: swap.marketAddress,
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
    const swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
    const market = await Market.getMarket(this.network, swap.marketAddress, undefined, txn);
    const baseDecimal = await this.netSrv.getTokenDecimals(this.provider, market.baseAddress);
    const quoteDecimal = await this.netSrv.getTokenDecimals(this.provider, market.quoteAddress);
    const recipient = swap.getPayer() == swap.provider ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotifyType.SwapOrderPaid, this.network, recipient, {
      marketAddress: swap.marketAddress,
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
  async onRewardWithdrawn(claimer: string, amount: BigNumber, event: Event, txn?: Transaction) {
    //
  }

  /**
   * Some fee was sent to the fee sharer contract
   * @param token The token address whose fee was transferred
   * @param amount The amount that was transferred
   * @param event The event object
   * @param txn The transaction object
   */
  async onTransferredToFeePool(token: string, amount: BigNumber, event: Event, txn?: Transaction) {
    // Add a task for the future
    const block = await event.getBlock();
    const mineAt = block.timestamp + parseInt(this.getParam('transferToFeePoolInterval'));
    await MineTask.create(
      {
        type: MineTaskType.FeeTransfer,
        network: this.network,
        transferredToken: token,
        transferredAmount: amount.toString(),
        mineAt: moment.unix(mineAt).toISOString(),
      },
      txn,
    );
    return Promise.resolve();
  }

  /**
   * The protocol fees was updated
   * @param instantSwapFeeBp The new instant swap fee in basis point
   * @param syntheticSwapFeeBp The new p2p swap fee in basis point
   * @param stableSwapFeeBp The new stable asset swap fee in basis point
   * @param fixedSynthSwapFee The new fee for SYNTH/SYNTH swap (in P2P)
   * @param fixedNFTSwapFee The new fee for NFT/NFT swap (in P2P)
   * @param instantNFTSwapFeeBp The new fee for NFT/ERC20 swap in basis point
   * @param event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeUpdated(
    instantSwapFeeBp: BigNumber,
    syntheticSwapFeeBp: BigNumber,
    stableSwapFeeBp: BigNumber,
    fixedSynthSwapFee: BigNumber,
    fixedNFTSwapFee: BigNumber,
    instantNFTSwapFeeBp: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.InstantSwapFeeBp),
      instantSwapFeeBp.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.SynthSwapFeeBp),
      syntheticSwapFeeBp.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.StableSwapFeeBp),
      stableSwapFeeBp.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.FixedSynthSwapFee),
      fixedSynthSwapFee.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.FixedNFTSwapFee),
      fixedNFTSwapFee.toString(),
      txn,
    );
    await Meta.update(
      Meta.makeProtocolFeeKey(this.network, FeeName.InstantNFTSwapFeeBp),
      instantNFTSwapFeeBp.toString(),
      txn,
    );
    return Promise.resolve();
  }

  /**
   * Market liquidity was updated
   * @param provider The liquidity owner address
   * @param marketAddress The market ID
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
    marketAddress: string,
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
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);

    // Find the provider
    const user = await User.getByAddress(provider);

    // Create the liquidity on database if not existing.
    // Otherwise, update the existing liquidity.
    const market = await Market.getMarket(this.network, marketAddress, undefined);
    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketAddress,
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
        base: market.base,
        baseAddress: market.baseAddress,
        quote: market.quote,
        quoteAddress: market.quoteAddress,
        marketAddress,
        provider,
        price: await Liquidity.getLowestPrice(
          this.network,
          marketAddress,
          undefined,
          undefined,
          txn,
        ),
      },
      txn,
    );

    return Promise.resolve();
  }

  /**
   * A market manager updated a liquidity's price
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The liquidity manager's address
   * @param price
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedPrice(
    marketAddress: string,
    provider: string,
    manager: string,
    price: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    // Get local liquidity
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);
    if (!liq) throw new Error('liquidity not found');

    // Update liquidity price
    await Liquidity.updateById(liq.id, { price: price.toString() }, txn);

    // Add new market price entry
    await MarketPrice.create(
      {
        network: this.network,
        base: liq.base,
        baseAddress: liq.baseAddress,
        quote: liq.quote,
        quoteAddress: liq.quoteAddress,
        marketAddress,
        provider,
        price: await Liquidity.getLowestPrice(
          this.network,
          marketAddress,
          undefined,
          undefined,
          txn,
        ),
      },
      txn,
    );

    return Promise.resolve();
  }

  /**
   * A liquidity pause status was updated
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param paused Indicates whether the liquidity has been paused or un-paused
   * @param event The event object
   * @param txn The transaction object
   */
  async onTogglePause(
    marketAddress: string,
    provider: string,
    paused: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);
    await Liquidity.updateById(liq.id, { paused });
    return Promise.resolve(undefined);
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onSetLiquidityManager(
    marketAddress: string,
    provider: string,
    manager: string,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);
    await Liquidity.updateById(liq.id, { manager }, txn);
    await this.notifSrv.notify(NotifyType.NewLiquidityManager, this.network, manager, {
      marketAddress,
      provider,
    });
    return Promise.resolve(undefined);
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The new liquidity manager's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onRemoveLiquidityManager(
    marketAddress: string,
    provider: string,
    manager: string,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, undefined, txn);
    if (liq) {
      await Liquidity.updateById(liq.id, { manager: null }, txn);
      await this.notifSrv.notify(NotifyType.RemoveLiquidityManager, this.network, manager, {
        marketAddress,
        provider,
      });
    }
    return Promise.resolve(undefined);
  }
}

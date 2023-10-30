import { Logger } from '@nestjs/common';
import { BigNumber, Event as ChainEvent, constants, providers } from 'ethers';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Transaction } from 'objection';
import { includesStr, isEqualStr, toDec } from '../../common/common';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import Dispute from '../../models/dispute';
import Event, { Events } from '../../models/event';
import Liquidity, { makeLiqAddress } from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Meta, { FeeName, ProtocolFeeBeneficiary } from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Offer from '../../models/offer';
import Swap from '../../models/swap';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { getBlockTime, pow10D, toBN } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private metadataSrv: MetadataService,
    private exrSrv: ExchangeRateService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(CoreHandler.name, netSrv.cfgSrv, network, contracts.core);
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
        swapper: string,
        recipient: string,
        numTypeInfo: BigNumber[],
        idsFromProvider: BigNumber[],
        idsFromTaker: BigNumber[],
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onSwapOrder(
          marketAddress,
          provider,
          swapper,
          recipient,
          numTypeInfo,
          idsFromProvider,
          idsFromTaker,
          event,
          txn,
        );
      },
    );

    this.on(
      'Swap',
      async (
        marketAddress: string,
        provider: string,
        swapper: string,
        recipient: string,
        releaser: string,
        numTypeInfo: BigNumber[],
        byDispute: boolean,
        idsFromProvider: BigNumber[],
        idsFromTaker: BigNumber[],
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onSwap(
          marketAddress,
          provider,
          swapper,
          recipient,
          releaser,
          numTypeInfo,
          byDispute,
          idsFromProvider,
          idsFromTaker,
          event,
          txn,
        );
      },
    );

    this.on(
      'OrderCancelled',
      async (orderId: BigNumber, canceller: string, byDispute: boolean, event: ChainEvent, txn?: Transaction) => {
        return this.onOrderCancelled(orderId, canceller, byDispute, event, txn);
      },
    );

    this.on(
      'SwapOrderPaid',
      async (orderId: BigNumber, disputeFrom: BigNumber, event: ChainEvent, txn?: Transaction) => {
        return this.onSwapOrderPaid(orderId, disputeFrom, event, txn);
      },
    );

    this.on(
      'TransferredToFeePool',
      async (
        token: string,
        amount: BigNumber,
        convAsset: string,
        convAmount: BigNumber,
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onTransferredToFeePool(token, amount, convAsset, convAmount, event, txn);
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
        event: ChainEvent,
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
      'UpdatedNonFungibleLiquidity',
      async (
        provider: string,
        marketAddress: string,
        target: string,
        deduct: boolean,
        paused: boolean,
        lid: BigNumber,
        ids: BigNumber[],
        price: BigNumber,
        wantOrIds: BigNumber[],
        wantAndIds: BigNumber[],
        timeToPay: BigNumber,
        event: ChainEvent,
        txn: Transaction,
      ) => {
        return this.onUpdatedNonFungibleLiquidity(
          provider,
          marketAddress,
          target,
          deduct,
          paused,
          lid,
          ids,
          price,
          wantOrIds,
          wantAndIds,
          timeToPay,
          event,
          txn,
        );
      },
    );

    this.on(
      'UpdatedFungibleLiquidity',
      async (
        provider: string,
        marketAddress: string,
        target: string,
        deduct: boolean,
        paused: boolean,
        lid: BigNumber,
        amount: BigNumber,
        price: BigNumber,
        wantOrIds: BigNumber[],
        wantAndIds: BigNumber[],
        minSwap: BigNumber,
        maxSwap: BigNumber,
        timeToPay: BigNumber,
        event: ChainEvent,
        txn: Transaction,
      ) => {
        return this.onUpdatedFungibleLiquidity(
          provider,
          marketAddress,
          target,
          deduct,
          paused,
          lid,
          amount,
          price,
          wantOrIds,
          wantAndIds,
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
        lid: BigNumber,
        price: BigNumber,
        event: ChainEvent,
        txn: Transaction,
      ) => {
        return this.onUpdatedPrice(marketAddress, provider, manager, lid, price, event, txn);
      },
    );

    this.on(
      'TogglePause',
      async (
        marketAddress: string,
        provider: string,
        lid: BigNumber,
        paused: boolean,
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onTogglePause(marketAddress, provider, lid, paused, event, txn);
      },
    );

    this.on(
      'UpdatedLiquidityManager',
      async (
        marketAddress: string,
        provider: string,
        manager: string,
        oldManager: string,
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquidityManager(marketAddress, provider, manager, oldManager, event, txn);
      },
    );

    this.on(
      'ProtocolFeeSplitUpdated',
      async (inventor: BigNumber, shared: BigNumber, operator: BigNumber, event: ChainEvent, txn?: Transaction) => {
        return this.onProtocolFeeSplitUpdated(inventor, shared, operator, event, txn);
      },
    );

    this.on('NFTDiscountUpdated', async (discountBp: BigNumber, event: ChainEvent, txn?: Transaction) => {
      return this.onNFTDiscountUpdated(discountBp, event, txn);
    });

    this.on(
      'NewOffer',
      async (
        marketAddress: string,
        provider: string,
        lid: BigNumber,
        offerer: string,
        offerId: BigNumber,
        amount: BigNumber,
        price: BigNumber,
        ids: BigNumber[],
        expireDuration: BigNumber,
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onNewOffer(
          marketAddress,
          provider,
          lid,
          offerer,
          offerId,
          amount,
          price,
          ids,
          expireDuration,
          event,
          txn,
        );
      },
    );

    this.on(
      'OfferUpdated',
      async (
        offerId: BigNumber,
        offerer: string,
        amount: BigNumber,
        price: BigNumber,
        ids: BigNumber[],
        expireDuration: BigNumber,
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onOfferUpdated(offerId, offerer, amount, price, ids, expireDuration, event, txn);
      },
    );

    this.on(
      'OfferAccepted',
      async (offerId: BigNumber, acceptor: string, execDelayDur: BigNumber, event: ChainEvent, txn?: Transaction) => {
        return this.onOfferAccepted(offerId, acceptor, execDelayDur, event, txn);
      },
    );

    this.on('OfferCancelled', async (offerId: BigNumber, canceller: string, event: ChainEvent, txn?: Transaction) => {
      return this.onOfferCancelled(offerId, canceller, event, txn);
    });

    this.on('OfferUnaccepted', async (offerId: BigNumber, unacceptor: string, event: ChainEvent, txn?: Transaction) => {
      return this.onOfferUnaccepted(offerId, unacceptor, event, txn);
    });

    this.on('OfferExecuted', async (offerId: BigNumber, executor: string, event: ChainEvent, txn?: Transaction) => {
      return this.onOfferExecuted(offerId, executor, event, txn);
    });

    this.on(
      'UpdatedLiquiditySwapBadges',
      async (
        marketAddress: string,
        provider: string,
        lid: BigNumber,
        badges: [string, string][],
        event: ChainEvent,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquiditySwapBadges(marketAddress, provider, lid, badges, event, txn);
      },
    );

    this.on('UpdatedMinTimeToPay', async (value: BigNumber, event: ChainEvent, txn?: Transaction) => {
      return this.onParameterUpdate('minTimeToPay', value.toString(), event, txn);
    });

    this.on('UpdatedOrderGraceDur', async (value: BigNumber, event: ChainEvent, txn?: Transaction) => {
      return this.onParameterUpdate('orderGraceDur', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenOrders', async (value: BigNumber, event: ChainEvent, txn?: Transaction) => {
      return this.onParameterUpdate('maxOpenOrders', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenDisputes', async (value: BigNumber, event: ChainEvent, txn?: Transaction) => {
      return this.onParameterUpdate('maxOpenDisputes', value.toString(), event, txn);
    });
  }

  /**
   * Get swap fees
   * @param swap The swap object
   * @param blockTag The block tag
   * @return
   */
  async computeSwapFees(
    swap: Partial<Swap>,
    blockTag?: providers.BlockTag,
  ): Promise<{ protocolFee: string; marketCreatorFee: string }> {
    const core = this.contracts.core;
    const fees: BigNumber[] = await core.computeSwapFee(
      swap.marketAddress,
      swap.provider,
      swap.lid,
      swap.taker,
      swap.amount,
      swap.price,
      { blockTag },
    );
    return Promise.resolve({
      protocolFee: fees[0].toString(),
      marketCreatorFee: fees[1].toString(),
    });
  }

  /**
   * Compute the USD value of a swap
   * @param market The market object
   * @param amount The swap amount
   * @param price The swap price
   */
  async computeSwapUsdValue(market: Market, amount: BigNumber, price: BigNumber) {
    const { baseType, base, quoteAddress, baseAddress, baseDecimals, quoteDecimals } = market;

    if (market.isInstant()) {
      const value = Market.isNFT(baseType)
        ? await this.metadataSrv.tryToUsd(this.network, price.toString(), quoteAddress)
        : await this.metadataSrv.tryToUsd(this.network, amount.toString(), baseAddress);
      return value.toString();
    }

    // ex: NFT/SYNTH
    if (Market.isNFT(baseType)) {
      const rate = await this.exrSrv.get(base);
      const toUsdRate = rate ? toDec(1).div(rate) : toDec(0);
      const priceHD = toDec(price.toString()).div(pow10D(quoteDecimals));
      return priceHD.mul(toUsdRate).toFixed();
    }

    // ex: ERC20/SYNTH
    if (Market.isERC20(baseType)) {
      return (await this.metadataSrv.tryToUsd(this.network, amount.toString(), baseAddress)).toString();
    }

    // SYNTH/*
    const rate = await this.exrSrv.get(base);
    const toUsdRate = rate ? toDec(1).div(rate) : toDec(0);
    const priceHD = toDec(amount.toString()).div(pow10D(baseDecimals));
    return priceHD.mul(toUsdRate).toFixed();
  }

  /**
   * Handle new swap order
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param _recipient An alternative recipient of the swapper's base asset
   * @param numTypeInfo List of integer parameters
   * @param idsFromProvider List of NFT IDs from the LP
   * @param idsFromTaker List of NFT IDs from the swapper
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrder(
    marketAddress: string,
    provider: string,
    swapper: string,
    _recipient: string,
    numTypeInfo: BigNumber[],
    idsFromProvider: BigNumber[],
    idsFromTaker: BigNumber[],
    event: ChainEvent,
    txn?: Transaction,
  ) {
    const [orderId, lid, , price, offerId, operator, cancelDuration] = numTypeInfo;
    let amount = numTypeInfo[2];

    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );

    // If base or quote is NFT, use the whole amount of the liquidity
    amount = Market.isNFT(market.baseType) || Market.isNFT(market.quoteType) ? toBN(liq.amount) : amount;

    // Create swap
    let swap: Partial<Swap> = {
      network: this.network,
      marketAddress,
      lid: lid.toNumber(),
      provider,
      taker: swapper,
      base: market.base,
      baseAddress: market.baseAddress,
      quote: market.quote,
      quoteAddress: market.quoteAddress,
      orderId: orderId.toNumber(),
      amount: amount.toString(),
      price: price.toString(),
      offerId: !offerId.isZero() ? offerId.sub(1).toNumber() : 0,
      providerIds: idsFromProvider.map((id) => id.toNumber()),
      takerIds: idsFromTaker.map((id) => id.toNumber()),
      operator: operator.toNumber(),
      txHash: event.transactionHash,
      cancelAt: moment
        .unix(await getBlockTime(event))
        .add(cancelDuration.toNumber(), 'seconds')
        .toISOString(),
    };

    // Get swap fee info
    const info = await this.computeSwapFees(swap, event.blockNumber);

    // Create swap entry
    swap = await Swap.create({ ...swap, ...info }, txn);

    // Update liquidity
    await Liquidity.updateById(
      liq.id,
      {
        openOrders: liq.openOrders + 1,
        amount: toBN(liq.amount).sub(swap.amount).toString(),
        totalSwaps: liq.totalSwaps + 1,
      },
      txn,
    );

    // Update market
    market = await Market.updateById(
      market.id,
      {
        totalLiquidity: toBN(market.totalLiquidity).sub(swap.amount).toString(),
        totalSwaps: market.totalSwaps + 1,
      },
      txn,
    );

    // Create liquidity event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: lid.toNumber(),
        creator: swapper,
        orderId: orderId.toNumber(),
        action: Events.LiquiditySwap,
      },
      txn,
    );

    // Send notification
    swap.market = market;
    await this.notifSrv.notify(NotificationID.NewInteractiveSwap, this.network, provider, <SwapOrderNotificationData>{
      marketAddress,
      provider,
      swapper,
      swap,
      market,
    });
  }

  /**
   * Handle completed swap
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param _recipient An alternative recipient of the swapper's base asset
   * @param releaser The releaser of the order
   * @param numTypeInfo List of integer parameters
   * @param byDispute Indicates whether the order was released by dispute
   * @param idsFromProvider List of NFT IDs from the LP
   * @param idsFromTaker List of NFT IDs from the swapper
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwap(
    marketAddress: string,
    provider: string,
    swapper: string,
    _recipient: string,
    releaser: string,
    numTypeInfo: BigNumber[],
    byDispute: boolean,
    idsFromProvider: BigNumber[],
    idsFromTaker: BigNumber[],
    event: ChainEvent,
    txn?: Transaction,
  ) {
    let [orderId] = numTypeInfo;
    const [, lid, , price, offerId, operator] = numTypeInfo;
    let amount = numTypeInfo[2];

    if (orderId.isZero()) {
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
      let liq = await Liquidity.getLiquidity(
        this.network,
        marketAddress,
        provider,
        lid.toNumber(),
        undefined,
        undefined,
        txn,
      );

      // If base or quote is NFT, use the whole amount of the liquidity
      amount = Market.isNFT(market.baseType) || Market.isNFT(market.quoteType) ? toBN(liq.amount) : amount;

      // Compute USD value of the swap
      const valueUsd = await this.computeSwapUsdValue(market, amount, price);

      // Get USD equivalent of the swap value
      let swap: Partial<Swap> = {
        network: this.network,
        lid: lid.toNumber(),
        marketAddress,
        provider,
        taker: swapper,
        base: market.base,
        baseAddress: market.baseAddress,
        quote: market.quote,
        quoteAddress: market.quoteAddress,
        orderId: !orderId.isZero() ? orderId.toNumber() - 1 : undefined,
        amount: amount.toString(),
        valueUsd,
        price: price.toString(),
        instant: orderId.isZero(),
        paid: orderId.isZero(),
        released: orderId.isZero(),
        offerId: !offerId.isZero() ? offerId.sub(1).toNumber() : 0,
        operator: operator.toNumber(),
        providerIds: idsFromProvider.map((id) => id.toNumber()),
        takerIds: idsFromTaker.map((id) => id.toNumber()),
        txHash: event.transactionHash,
      };
      const info = await this.computeSwapFees(swap, event.blockNumber);
      swap = await Swap.create({ ...swap, ...info }, txn);

      // Update liquidity
      const now = moment().toISOString();
      liq = await Liquidity.updateById(
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
      market = await Market.updateById(
        market.id,
        {
          lastSwapAt: now,
          amountSwapped: toBN(market.amountSwapped).add(amount).toString(),
          totalSwaps: market.totalSwaps + 1,
          totalLiquidity: toBN(market.totalLiquidity).sub(amount).toString(),
        },
        txn,
      );

      // Create liquidity event
      await Event.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: lid.toNumber(),
          creator: swapper,
          orderId: orderId.toNumber(),
          action: Events.LiquiditySwap,
        },
        txn,
      );

      // Send notification
      await this.notifSrv.notify(NotificationID.NewInstantSwap, this.network, provider, <InstantSwapNotificationData>{
        market,
        swap,
        liq,
      });
    } else {
      orderId = orderId.sub(1);
      const now = moment();
      let swap = await Swap.get(this.network, orderId.toNumber(), undefined, undefined, txn);
      const { marketAddress, provider } = swap;
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);

      // Compute USD value of the swap
      const valueUsd = await this.computeSwapUsdValue(market, toBN(swap.amount), price);

      // Update the swap
      swap = await Swap.updateById(
        swap.id,
        {
          valueUsd,
          released: true,
          byDispute,
          finalizer: releaser,
          finalizedAt: now.toISOString(),
        },
        txn,
      );

      // Mark the last dispute as `orderReleased` if there is any
      const dispute = await Dispute.getRecentOfOrder(this.network, marketAddress, orderId.toNumber(), txn);
      if (dispute && !dispute.orderReleased) {
        await Dispute.updateById(dispute.id, { orderReleased: true }, txn);
      }

      // Update liquidity
      let liq = await Liquidity.getLiquidity(
        this.network,
        marketAddress,
        provider,
        lid.toNumber(),
        undefined,
        undefined,
        txn,
      );
      let newCompletionRate = await Swap.getCompletionRate(this.network, marketAddress, provider, undefined, txn);
      liq = await Liquidity.updateById(
        liq.id,
        {
          openOrders: liq.openOrders - 1,
          lastSwapAt: now.toISOString(),
          amountSwapped: toBN(liq.amountSwapped).add(amount).toString(),
          completionRate: dispute ? liq.completionRate : newCompletionRate,
          avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, provider, lid.toNumber(), txn),
          avgReleaseDur: await Swap.getAvgReleaseDuration(
            this.network,
            marketAddress,
            provider,
            lid.toNumber(),
            undefined,
            txn,
          ),
        },
        txn,
      );

      // Update market
      newCompletionRate = await Swap.getCompletionRate(this.network, marketAddress, undefined, undefined, txn);
      market = await Market.updateById(
        market.id,
        {
          lastSwapAt: now.toISOString(),
          amountSwapped: toBN(market.amountSwapped).add(amount).toString(),
          completionRate: dispute ? market.completionRate : newCompletionRate,
          avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, undefined, undefined, txn),
          avgReleaseDur: await Swap.getAvgReleaseDuration(
            this.network,
            marketAddress,
            undefined,
            undefined,
            undefined,
            txn,
          ),
        },
        txn,
      );
      swap.market = market;

      // Create swap event
      await Event.create(
        {
          network: this.network,
          marketAddress,
          orderId: orderId.toNumber(),
          creator: releaser,
          action: Events.SwapReleased,
        },
        txn,
      );

      // Send notification
      // Send to either taker or provider if one of them is the finalizer.
      // or send to both if neither is the finalizer
      const notifData = { market, liq, swap };
      if (includesStr([swap.provider, swap.taker], swap.finalizer)) {
        await this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.getPayer(), notifData);
      } else {
        await this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.provider, notifData);
        await this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.taker, notifData);
      }
    }
  }

  /**
   * Handle order cancellation
   * @param orderId The new order ID (non-zero)
   * @param canceller The order canceller's address
   * @param byDispute Indicates whether the order was cancelled by dispute
   * @param _event The event object
   * @param txn The transaction object
   */
  async onOrderCancelled(
    orderId: BigNumber,
    canceller: string,
    byDispute: boolean,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    const now = moment();

    // Mark swap order as `cancelled`
    let swap = await Swap.get(this.network, orderId.toNumber(), undefined, undefined, txn);
    swap = await Swap.updateById(
      swap.id,
      {
        cancelled: true,
        byDispute,
        finalizer: canceller,
        finalizedAt: now.toISOString(),
      },
      txn,
    );

    // Update liquidity
    const { marketAddress, provider, lid } = swap;
    let liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);
    liq = await Liquidity.updateById(liq.id, {
      openOrders: liq.openOrders - 1,
      amount: toBN(liq.amount).add(swap.amount).toString(),
      avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, provider, lid, txn),
    });

    // Update market
    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    market = await Market.updateById(
      market.id,
      {
        totalLiquidity: toBN(market.totalLiquidity).add(swap.amount).toString(),
        avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, undefined, undefined, txn),
      },
      txn,
    );

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: orderId.toNumber(),
        creator: canceller,
        action: Events.SwapCancelled,
      },
      txn,
    );

    // Send notification.
    // Send to either taker or provider if one of them is the canceller.
    // or send to both if neither is the canceller
    swap.market = market;
    const notifData = { market, liq, swap };
    if (includesStr([swap.provider, swap.taker], canceller)) {
      const recipient = swap.provider === canceller ? swap.taker : swap.provider;
      await this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, recipient, notifData);
    } else {
      await this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, swap.provider, notifData);
      await this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, swap.taker, notifData);
    }
  }

  /**
   * An order was marked as `paid`
   * @param orderId The order ID
   * @param disputeFrom The duration after which the order can be disputed
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrderPaid(orderId: BigNumber, disputeFrom: BigNumber, event: ChainEvent, txn?: Transaction) {
    let swap = await Swap.get(this.network, orderId.toNumber(), undefined, undefined, txn);

    // Update the order
    swap = await Swap.updateById(
      swap.id,
      {
        paid: true,
        payer: swap.getPayer(),
        paidAt: moment().toISOString(),
        disputeFrom: moment
          .unix(await getBlockTime(event))
          .add(disputeFrom.toNumber(), 'seconds')
          .toISOString(),
      },
      txn,
    );

    // Update liquidity
    const { marketAddress, provider, lid } = swap;
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);
    await Liquidity.updateById(
      liq.id,
      { avgPaymentDur: await Swap.getAvgPaymentDuration(this.network, marketAddress, provider, lid, undefined, txn) },
      txn,
    );

    // Update market
    let market = await Market.getMarket(this.network, swap.marketAddress, undefined, undefined, txn);
    market = await Market.updateById(
      market.id,
      {
        avgPaymentDur: await Swap.getAvgPaymentDuration(
          this.network,
          market.address,
          undefined,
          undefined,
          undefined,
          txn,
        ),
      },
      txn,
    );
    swap.market = market;

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: orderId.toNumber(),
        creator: swap.payer,
        action: Events.SwapPaid,
      },
      txn,
    );

    // Send notification
    const recipient = swap.payer == swap.provider ? swap.taker : swap.provider;
    await this.notifSrv.notify(NotificationID.SwapOrderPaid, this.network, recipient, {
      swap,
      market,
    });
  }

  /**
   * Fee earned on a token was converted and transferred to the fee pool
   * @param token The token address whose fee was converted and transferred
   * @param _amount The amount that was transferred
   * @param _convAsset The asset the fee was converted to
   * @param _convAmount The amount after conversion
   * @param event The event object
   * @param txn The transaction object
   */
  async onTransferredToFeePool(
    token: string,
    _amount: BigNumber,
    _convAsset: string,
    _convAmount: BigNumber,
    event: ChainEvent,
    txn?: Transaction,
  ) {
    // Add a task for the future
    const blockTime = await getBlockTime(event);
    const mineAt = blockTime + ((await Meta.getContractParam(this.network, 'transferToFeePoolInterval')) as number);
    await MineTask.create(
      {
        type: MineTaskType.FeeTransfer,
        network: this.network,
        token,
        mineAt: moment.unix(mineAt).toISOString(),
      },
      txn,
    );
  }

  /**
   * The protocol fees was updated
   * @param instantSwapFeeBp The new instant swap fee in basis point
   * @param syntheticSwapFeeBp The new p2p swap fee in basis point
   * @param stableSwapFeeBp The new stable asset swap fee in basis point
   * @param fixedSynthSwapFee The new fee for SYNTH/SYNTH swap (in P2P)
   * @param fixedNFTSwapFee The new fee for NFT/NFT swap (in P2P)
   * @param instantNFTSwapFeeBp The new fee for NFT/ERC20 swap in basis point
   * @param _event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeUpdated(
    instantSwapFeeBp: BigNumber,
    syntheticSwapFeeBp: BigNumber,
    stableSwapFeeBp: BigNumber,
    fixedSynthSwapFee: BigNumber,
    fixedNFTSwapFee: BigNumber,
    instantNFTSwapFeeBp: BigNumber,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    await Meta.update(Meta.makeNetKey(this.network, FeeName.InstantSwapFeeBp), instantSwapFeeBp.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, FeeName.SynthSwapFeeBp), syntheticSwapFeeBp.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, FeeName.StableSwapFeeBp), stableSwapFeeBp.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, FeeName.FixedSynthSwapFee), fixedSynthSwapFee.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, FeeName.FixedNFTSwapFee), fixedNFTSwapFee.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, FeeName.InstantNFTSwapFeeBp), instantNFTSwapFeeBp.toString(), txn);
  }

  /**
   * Non-fungible market liquidity was updated
   * @param provider The liquidity owner address
   * @param marketAddress The market ID
   * @param target The target of the liquidity
   * @param deduct Indicate whether the liquidity is deducted from
   * @param paused Whether the liquidity is paused
   * @param lid The liquidity ID
   * @param ids The NFT IDs involved in the update
   * @param price The latest price
   * @param wantOrIds A list of OR IDs wanted
   * @param wantAndIds A list of AND IDs wanted
   * @param timeToPay The number of seconds within which payment must be received
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedNonFungibleLiquidity(
    provider: string,
    marketAddress: string,
    target: string,
    deduct: boolean,
    paused: boolean,
    lid: BigNumber,
    ids: BigNumber[],
    price: BigNumber,
    wantOrIds: BigNumber[],
    wantAndIds: BigNumber[],
    timeToPay: BigNumber,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);

    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketAddress,
          address: makeLiqAddress(marketAddress, provider, lid.toNumber()),
          target,
          paused,
          lid: lid.toNumber(),
          base: market.base,
          baseAddress: market.baseAddress,
          baseType: market.baseType,
          quote: market.quote,
          quoteAddress: market.quoteAddress,
          quoteType: market.quoteType,
          ids: ids.map((id) => id.toNumber()),
          price: price.toString(),
          amount: ids.length.toString(),
          wantAndIds: wantAndIds.map((id) => id.toNumber()),
          wantOrIds: wantOrIds.map((id) => id.toNumber()),
          timeToPay: timeToPay.toNumber(),
        },
        txn,
      );

      // Update market
      await Market.updateById(
        market.id,
        { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
        txn,
      );
    } else {
      const upd: Partial<Liquidity> = {};

      const _ids = ids.map((id) => id.toNumber());
      if (!_.isEqual(liq.ids, _ids)) {
        if (deduct) upd.ids = _.difference(liq.ids, _ids);
        else upd.ids = _.union(liq.ids, _ids);
        upd.amount = upd.ids.length.toString();
      }

      if (liq.target != target) upd.target = target;
      if (liq.paused != paused) upd.paused = paused;
      if (liq.price !== price.toString()) upd.price = price.toString();
      if (liq.timeToPay !== timeToPay.toNumber()) upd.timeToPay = timeToPay.toNumber();

      const _wantAndIds = wantAndIds.map((id) => id.toNumber());
      if (!_.isEqual(liq.wantAndIds, _wantAndIds)) upd.wantAndIds = _wantAndIds;

      const _wantOrIds = wantOrIds.map((id) => id.toNumber());
      if (!_.isEqual(liq.wantOrIds, _wantOrIds)) upd.wantOrIds = _wantOrIds;

      // Update liquidity
      await Liquidity.updateById(liq.id, upd, txn);

      // Update market
      await Market.updateById(
        market.id,
        { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
        txn,
      );
    }

    // Add new market price entry, if quote is not NFT - since price is not
    // applicable for NFT/NFT market
    if (!Market.isNFT(market.quoteType)) {
      await MarketPrice.create(
        {
          network: this.network,
          marketAddress,
          baseAddress: market.baseAddress,
          quoteAddress: market.quoteAddress,
          provider,
          lid: lid.toNumber(),
          price: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
        },
        txn,
      );
    }
  }

  /**
   * Fungible market liquidity was updated
   * @param provider The liquidity owner address
   * @param marketAddress The market ID
   * @param target The target of the liquidity
   * @param deduct Indicate whether the liquidity is deducted from
   * @param paused Indicate whether the liquidity is paused
   * @param lid The liquidity ID
   * @param amount The current amount of liquidity
   * @param price The latest price
   * @param wantOrIds A list of OR IDs wanted
   * @param wantAndIds A list of AND IDs wanted
   * @param minSwap The minimum amount of swap
   * @param maxSwap The maximum amount of swap
   * @param timeToPay The number of seconds within which payment must be received
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedFungibleLiquidity(
    provider: string,
    marketAddress: string,
    target: string,
    deduct: boolean,
    paused: boolean,
    lid: BigNumber,
    amount: BigNumber,
    price: BigNumber,
    wantOrIds: BigNumber[],
    wantAndIds: BigNumber[],
    minSwap: BigNumber,
    maxSwap: BigNumber,
    timeToPay: BigNumber,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    let liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const common = {
      network: this.network,
      marketAddress,
      provider,
      lid: lid.toNumber(),
      creator: provider,
    };

    if (!liq) {
      liq = await Liquidity.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: lid.toNumber(),
          address: makeLiqAddress(marketAddress, provider, lid.toNumber()),
          target,
          paused,
          base: market.base,
          baseAddress: market.baseAddress,
          baseType: market.baseType,
          quote: market.quote,
          quoteAddress: market.quoteAddress,
          quoteType: market.quoteType,
          amount: amount.toString(),
          price: price.toString(),
          wantAndIds: wantAndIds.map((id) => id.toNumber()),
          wantOrIds: wantOrIds.map((id) => id.toNumber()),
          minSwap: minSwap.toString(),
          maxSwap: maxSwap.toString(),
          timeToPay: timeToPay.toNumber(),
        },
        txn,
      );

      // Update market
      await Market.updateById(
        market.id,
        {
          totalLiquidity: toBN(market.totalLiquidity).add(amount).toString(),
          lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
        },
        txn,
      );

      await Event.create(
        {
          ...common,
          action: Events.LiquidityAdd,
          amount: liq.amount,
          price: liq.price,
          minSwap: liq.minSwap,
          maxSwap: liq.maxSwap,
          target: liq.target,
          timeToPay: liq.timeToPay,
          paused: liq.paused,
        },
        txn,
      );
    } else {
      const ch: Partial<Liquidity> = {};
      const mktCh: Partial<Market> = {};

      if (!amount.isZero()) {
        ch.amount = deduct ? toBN(liq.amount).sub(amount).toString() : toBN(liq.amount).add(amount).toString();
        mktCh.totalLiquidity = deduct
          ? toBN(market.totalLiquidity).sub(amount).toString()
          : toBN(market.totalLiquidity).add(amount).toString();
      }

      if (liq.target != target) ch.target = target;
      if (liq.paused != paused) ch.paused = paused;
      if (liq.price !== price.toString()) ch.price = price.toString();
      if (liq.minSwap !== minSwap.toString()) ch.minSwap = minSwap.toString();
      if (liq.maxSwap !== maxSwap.toString()) ch.maxSwap = maxSwap.toString();
      if (liq.timeToPay !== timeToPay.toNumber()) ch.timeToPay = timeToPay.toNumber();

      const _wantAndIds = wantAndIds.map((id) => id.toNumber());
      if (!_.isEqual(liq.wantAndIds, _wantAndIds)) ch.wantAndIds = _wantAndIds;
      const _wantOrIds = wantOrIds.map((id) => id.toNumber());
      if (!_.isEqual(liq.wantOrIds, _wantOrIds)) ch.wantOrIds = _wantOrIds;

      await Liquidity.updateById(liq.id, ch, txn);

      mktCh.lowestPrice = await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn);
      await Market.updateById(market.id, mktCh, txn);

      if (liq.amount != ch.amount) {
        const action = deduct ? Events.LiquidityRemove : Events.LiquidityAdd;
        await Event.create({ ...common, amount: amount.toString(), action }, txn);
      }

      if (liq.price != ch.price) {
        await Event.create({ ...common, price: ch.price, action: Events.LiquidityPriceUpdate }, txn);
      }

      if (liq.paused != ch.paused) {
        await Event.create({ ...common, paused: ch.paused, action: Events.LiquidityPause }, txn);
      }

      if (liq.target != ch.target) {
        await Event.create({ ...common, target: ch.target, action: Events.LiquidityTargetUpdate }, txn);
      }

      if (liq.timeToPay != ch.timeToPay) {
        await Event.create({ ...common, timeToPay: ch.timeToPay, action: Events.LiquidityTimeToPayUpdate }, txn);
      }

      if (liq.minSwap != ch.minSwap || liq.maxSwap != ch.maxSwap) {
        await Event.create(
          {
            ...common,
            minSwap: ch.minSwap || liq.minSwap,
            maxSwap: ch.maxSwap || liq.maxSwap,
            action: Events.LiquiditySwapLimitUpdate,
          },
          txn,
        );
      }
    }

    // Add new market price entry, if quote is not NFT - since price is not
    // applicable for NFT/NFT market
    if (!Market.isNFT(market.quoteType)) {
      await MarketPrice.create(
        {
          network: this.network,
          marketAddress,
          provider,
          baseAddress: market.baseAddress,
          quoteAddress: market.quoteAddress,
          lid: lid.toNumber(),
          price: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
        },
        txn,
      );
    }
  }

  /**
   * A market manager updated a liquidity's price
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The liquidity manager's address
   * @param lid The liquidity ID
   * @param price The updated price
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedPrice(
    marketAddress: string,
    provider: string,
    manager: string,
    lid: BigNumber,
    price: BigNumber,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );

    // Update liquidity
    await Liquidity.updateById(liq.id, { price: price.toString() }, txn);

    // Add new market price entry
    await MarketPrice.create(
      {
        network: this.network,
        marketAddress,
        provider,
        baseAddress: liq.baseAddress,
        quoteAddress: liq.quoteAddress,
        lid: lid.toNumber(),
        price: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
      },
      txn,
    );

    // Update market
    await Market.updateByNetworkAddress(this.network, marketAddress, {
      lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
    });

    // Add liquidity event
    if (liq.price != price.toString()) {
      await Event.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: lid.toNumber(),
          creator: manager,
          price: price.toString(),
          action: Events.LiquidityPriceUpdate,
        },
        txn,
      );
    }
  }

  /**
   * A liquidity pause status was updated
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param lid The liquidity ID
   * @param paused Indicates whether the liquidity has been paused or un-paused
   * @param _event The event object
   * @param txn The transaction object
   */
  async onTogglePause(
    marketAddress: string,
    provider: string,
    lid: BigNumber,
    paused: boolean,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );

    await Liquidity.updateById(liq.id, { paused });

    // Add liquidity event
    if (liq.paused != paused) {
      await Event.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: lid.toNumber(),
          creator: provider,
          paused,
          action: Events.LiquidityPause,
        },
        txn,
      );
    }
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The new liquidity manager's address
   * @param oldManager The old liquidity manager's address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedLiquidityManager(
    marketAddress: string,
    provider: string,
    manager: string,
    oldManager: string,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    if (isEqualStr(manager, oldManager)) return;

    const liquidities = await Liquidity.getLiquidities(this.network, marketAddress, provider, txn);
    for (const liq of liquidities) {
      await Liquidity.updateById(liq.id, { manager }, txn);
      await Event.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: liq.lid,
          creator: provider,
          manager,
          action: Events.LiquidityManagerUpdate,
        },
        txn,
      );
    }

    // Notify the old manager
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const notifData = { market, provider };
    if (oldManager != constants.AddressZero && !isEqualStr(manager, oldManager)) {
      await this.notifSrv.notify(NotificationID.RemoveLiquidityManager, this.network, oldManager, notifData);
    }

    // Notify the new manager
    await this.notifSrv.notify(NotificationID.UpdatedLiquidityManager, this.network, manager, notifData);
  }

  /**
   * Protocol fee split basis point was updated
   * @param inventor The inventor's share of the protocol fee (in basis points)
   * @param shared The community's share of the protocol fee (in basis points)
   * @param operator The operator's share of the protocol fee (in basis points)
   * @param _event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeSplitUpdated(
    inventor: BigNumber,
    shared: BigNumber,
    operator: BigNumber,
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Inventor), inventor.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Shared), shared.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Operator), operator.toString(), txn);
  }

  /**
   * NFT Discount basis point was updated
   * @param discountBp The discount basis point
   * @param event The event object
   * @param txn The transaction object
   */
  async onNFTDiscountUpdated(discountBp: BigNumber, event: ChainEvent, txn?: Transaction) {
    await this.onParameterUpdate('nftDiscountBP', discountBp.toString(), event, txn);
  }

  /**
   * New offer was created
   * @param marketAddress The market address
   * @param provider The liquidity provider's address
   * @param lid The liquidity ID
   * @param offerer The offer creator's address
   * @param offerId The offer ID
   * @param amount The offer amount
   * @param price The offer price
   * @param ids The offered NFT IDs
   * @param expireDuration The offer expiry duration
   * @param event The event object
   * @param txn The transaction object
   */
  async onNewOffer(
    marketAddress: string,
    provider: string,
    lid: BigNumber,
    offerer: string,
    offerId: BigNumber,
    amount: BigNumber,
    price: BigNumber,
    ids: BigNumber[],
    expireDuration: BigNumber,
    event: ChainEvent,
    txn?: Transaction,
  ) {
    // Save the offer
    const offer = await Offer.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: lid.toNumber(),
        offerId: offerId.sub(1).toNumber(),
        creator: offerer,
        amount: amount.toString(),
        price: price.toString(),
        ids: ids.map((id) => id.toNumber()),
        deadline: moment
          .unix(await getBlockTime(event))
          .add(expireDuration.toNumber(), 'seconds')
          .toISOString(),
      },
      txn,
    );

    await Event.create(
      {
        network: this.network,
        marketAddress,
        offerId: offer.offerId,
        creator: offerer,
        amount: offer.amount,
        price: offer.price,
        ids: offer.ids,
        action: Events.OfferCreate,
      },
      txn,
    );

    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      undefined,
      undefined,
      txn,
    );
    await Event.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: lid.toNumber(),
        creator: offerer,
        offerId: offer.offerId,
        action: Events.LiquidityOffer,
      },
      txn,
    );

    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);

    // Send notification
    await this.notifSrv.notify(NotificationID.NewOffer, this.network, provider, {
      market,
      liq,
      offer,
    });
  }

  /**
   * Offer was updated
   * @param offerId The offer ID
   * @param offerer The offer creator's address
   * @param amount The updated amount
   * @param price The updated price
   * @param ids The updated offered NFT IDs
   * @param expireDuration The updated offer expiry duration
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferUpdated(
    offerId: BigNumber,
    offerer: string,
    amount: BigNumber,
    price: BigNumber,
    ids: BigNumber[],
    expireDuration: BigNumber,
    event: ChainEvent,
    txn?: Transaction,
  ) {
    const offer = await Offer.updateByOfferId(
      offerId.toNumber(),
      {
        amount: amount.toString(),
        price: price.toString(),
        ids: ids.map((id) => id.toNumber()),
        accepted: false,
        deadline: moment
          .unix(await getBlockTime(event))
          .add(expireDuration.toNumber(), 'seconds')
          .toISOString(),
      },
      txn,
    );

    await Event.create(
      {
        network: this.network,
        marketAddress: offer.marketAddress,
        offerId: offer.offerId,
        creator: offerer,
        amount: offer.amount,
        price: offer.price,
        ids: offer.ids,
        action: Events.OfferUpdate,
      },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // Send notification
    await this.notifSrv.notify(NotificationID.OfferUpdated, this.network, offer.provider, {
      updated: true,
      market,
      liq,
      offer,
    });
  }

  /**
   * Offer was accepted
   * @param offerId The offer ID
   * @param acceptor The offer acceptor's address
   * @param execDelayDur The offer execution delay duration
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferAccepted(
    offerId: BigNumber,
    acceptor: string,
    execDelayDur: BigNumber,
    event: ChainEvent,
    txn?: Transaction,
  ) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, offerId.toNumber(), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(
      offerId.toNumber(),
      {
        accepted: true,
        execAt: moment
          .unix(await getBlockTime(event))
          .add(execDelayDur.toNumber(), 'seconds')
          .toISOString(),
      },
      txn,
    );

    await Event.create(
      {
        network: this.network,
        marketAddress: offer.marketAddress,
        offerId: offer.offerId,
        creator: acceptor,
        action: Events.OfferAccept,
      },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // Send notification
    await this.notifSrv.notify(NotificationID.OfferAccepted, this.network, offer.creator, {
      offer,
      liq,
      market,
    });
  }

  /**
   * Offer was unaccepted
   * @param offerId The offer ID
   * @param unacceptor The offer unacceptor's address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onOfferUnaccepted(offerId: BigNumber, unacceptor: string, _event: ChainEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, offerId.toNumber(), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { accepted: false, execAt: null }, txn);

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    await Event.create(
      {
        network: this.network,
        marketAddress,
        offerId: offer.offerId,
        creator: unacceptor,
        action: Events.OfferUnaccept,
      },
      txn,
    );

    // Send notification
    await this.notifSrv.notify(NotificationID.OfferUnaccepted, this.network, offer.creator, {
      offer,
      liq,
      market,
    });
  }

  /**
   * Offer was cancelled
   * @param offerId The offer ID
   * @param canceller The offer canceller's address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onOfferCancelled(offerId: BigNumber, canceller: string, _event: ChainEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, offerId.toNumber(), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { cancelled: true }, txn);

    await Event.create(
      {
        network: this.network,
        marketAddress: offer.marketAddress,
        offerId: offer.offerId,
        creator: canceller,
        action: Events.OfferCancel,
      },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // Send notification
    await this.notifSrv.notify(NotificationID.OfferCancelled, this.network, offer.provider, {
      offer,
      liq,
      market,
    });
  }

  /**
   * Offer was unaccepted
   * @param offerId The offer ID
   * @param executor The offer executor's address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onOfferExecuted(offerId: BigNumber, executor: string, _event: ChainEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, offerId.toNumber(), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { executed: true }, txn);

    await Event.create(
      {
        network: this.network,
        marketAddress: offer.marketAddress,
        offerId: offer.offerId,
        creator: executor,
        action: Events.OfferExecute,
      },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // Send notification
    await this.notifSrv.notify(NotificationID.OfferExecuted, this.network, offer.provider, {
      offer,
      market,
      liq,
    });
  }

  /**
   * Liquidity swap badges were updated
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param lid The liquidity ID
   * @param badges The updated badges
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedLiquiditySwapBadges(
    marketAddress: string,
    provider: string,
    lid: BigNumber,
    badges: [string, string][],
    _event: ChainEvent,
    txn?: Transaction,
  ) {
    await Liquidity.update(
      this.network,
      marketAddress,
      provider,
      lid.toNumber(),
      { requiredSwapBadges: badges.map((b) => b.join('/').replace(/\/$/, '')) },
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
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: ChainEvent, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}

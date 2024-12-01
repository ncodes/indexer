import { Logger } from '@nestjs/common';
import { BlockTag, Provider, ZeroAddress } from 'ethers';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Transaction } from 'objection';
import { includesStr, isEqualStr, toDec } from '../../common/common';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import { NotificationID } from '../../jobs/notifications/common';
import Dispute from '../../models/dispute';
import Event, { Events } from '../../models/event';
import Liquidity, { makeLiqAddress } from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Meta, { FeeName, ProtocolFeeBeneficiary } from '../../models/meta';
import MineTask, { MineTaskType } from '../../models/mine_task';
import Offer from '../../models/offer';
import Swap from '../../models/swap';
import User from '../../models/user';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ContractCallEvent, getBlockTime, isZero, pow10, toBigInt, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotificationService,
    private metadataSrv: MetadataService,
    private exrSrv: ExchangeRateService,
    private provider: Provider,
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
        numTypeInfo: bigint[],
        idsFromProvider: bigint[],
        idsFromTaker: bigint[],
        event: ContractCallEvent,
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
        numTypeInfo: bigint[],
        byDispute: boolean,
        idsFromProvider: bigint[],
        idsFromTaker: bigint[],
        event: ContractCallEvent,
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
      async (orderId: bigint, canceller: string, byDispute: boolean, event: ContractCallEvent, txn?: Transaction) => {
        return this.onOrderCancelled(orderId, canceller, byDispute, event, txn);
      },
    );

    this.on(
      'SwapOrderPaid',
      async (orderId: bigint, payer: string, disputeDelayDur: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onSwapOrderPaid(orderId, payer, disputeDelayDur, event, txn);
      },
    );

    this.on(
      'TransferredToFeePool',
      async (
        token: string,
        amount: bigint,
        convAsset: string,
        convAmount: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onTransferredToFeePool(token, amount, convAsset, convAmount, event, txn);
      },
    );

    this.on(
      'ProtocolFeeUpdated',
      async (
        instantSwapFeeBp: bigint,
        syntheticSwapFeeBp: bigint,
        stableSwapFeeBp: bigint,
        fixedSynthSwapFee: bigint,
        fixedNFTSwapFee: bigint,
        instantNFTSwapFeeBp: bigint,
        event: ContractCallEvent,
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
        lid: bigint,
        ids: bigint[],
        price: bigint,
        wantOrIds: bigint[],
        wantAndIds: bigint[],
        timeToPay: bigint,
        event: ContractCallEvent,
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
        lid: bigint,
        amount: bigint,
        price: bigint,
        wantOrIds: bigint[],
        wantAndIds: bigint[],
        minSwap: bigint,
        maxSwap: bigint,
        timeToPay: bigint,
        event: ContractCallEvent,
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
        lid: bigint,
        price: bigint,
        event: ContractCallEvent,
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
        lid: bigint,
        paused: boolean,
        event: ContractCallEvent,
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
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquidityManager(marketAddress, provider, manager, oldManager, event, txn);
      },
    );

    this.on(
      'ProtocolFeeSplitUpdated',
      async (inventor: bigint, shared: bigint, operator: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onProtocolFeeSplitUpdated(inventor, shared, operator, event, txn);
      },
    );

    this.on('NFTDiscountUpdated', async (discountBp: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onNFTDiscountUpdated(discountBp, event, txn);
    });

    this.on(
      'NewOffer',
      async (
        marketAddress: string,
        provider: string,
        lid: bigint,
        offerer: string,
        offerId: bigint,
        amount: bigint,
        price: bigint,
        ids: bigint[],
        expireDuration: bigint,
        event: ContractCallEvent,
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
        offerId: bigint,
        offerer: string,
        amount: bigint,
        price: bigint,
        ids: bigint[],
        expireDuration: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onOfferUpdated(offerId, offerer, amount, price, ids, expireDuration, event, txn);
      },
    );

    this.on(
      'OfferAccepted',
      async (offerId: bigint, acceptor: string, execDelayDur: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onOfferAccepted(offerId, acceptor, execDelayDur, event, txn);
      },
    );

    this.on(
      'OfferCancelled',
      async (offerId: bigint, canceller: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onOfferCancelled(offerId, canceller, event, txn);
      },
    );

    this.on(
      'OfferUnaccepted',
      async (offerId: bigint, unacceptor: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onOfferUnaccepted(offerId, unacceptor, event, txn);
      },
    );

    this.on('OfferExecuted', async (offerId: bigint, executor: string, event: ContractCallEvent, txn?: Transaction) => {
      return this.onOfferExecuted(offerId, executor, event, txn);
    });

    this.on(
      'UpdatedLiquiditySwapBadges',
      async (
        marketAddress: string,
        provider: string,
        lid: bigint,
        badges: [string, string][],
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquiditySwapBadges(marketAddress, provider, lid, badges, event, txn);
      },
    );

    this.on('UpdatedMinTimeToPay', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('minTimeToPay', value.toString(), event, txn);
    });

    this.on('UpdatedOrderGraceDur', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('orderGraceDur', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenOrders', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('maxOpenOrders', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenDisputes', async (value: bigint, event: ContractCallEvent, txn?: Transaction) => {
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
    blockTag?: BlockTag,
  ): Promise<{ protocolFee: string; marketCreatorFee: string }> {
    const core = this.contracts.core;

    let fees: bigint[];
    try {
      fees = await core.computeSwapFee(
        swap.marketAddress,
        swap.provider,
        swap.lid,
        swap.taker,
        swap.amount,
        swap.price,
        { blockTag },
      );
    } catch (error) {
      if (JSON.stringify(error).includes('missing trie node')) {
        this.logger.warn('Missing Trie Node', error);
        return Promise.resolve({
          protocolFee: '0',
          marketCreatorFee: '0',
        });
      }
      throw error;
    }

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
  async computeSwapUsdValue(market: Market, amount: bigint, price: bigint) {
    const { baseType, base, quoteAddress, baseAddress, baseDecimals, quoteDecimals } = market;

    if (market.isInstant()) {
      const value = Market.isNFT(baseType)
        ? await this.metadataSrv.tryToUsd(this.network, price.toString(), quoteAddress)
        : await this.metadataSrv.tryToUsd(this.network, amount.toString(), baseAddress);
      return toDec(value).toFixed();
    }

    // ex: NFT/SYNTH
    if (Market.isNFT(baseType)) {
      const rate = await this.exrSrv.get(base);
      const toUsdRate = rate ? toDec(1).div(rate) : toDec(0);
      const priceHD = toDec(price.toString()).div(pow10(quoteDecimals));
      return priceHD.mul(toUsdRate).toFixed();
    }

    // ex: ERC20/SYNTH
    if (Market.isERC20(baseType)) {
      const value = await this.metadataSrv.tryToUsd(this.network, amount.toString(), baseAddress);
      return toDec(value).toFixed();
    }

    // SYNTH/*
    const rate = await this.exrSrv.get(base);
    const toUsdRate = rate ? toDec(1).div(rate) : toDec(0);
    const priceHD = toDec(amount.toString()).div(pow10(baseDecimals));
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
    numTypeInfo: bigint[],
    idsFromProvider: bigint[],
    idsFromTaker: bigint[],
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const [orderId, lid, , price, offerId, operator, cancelDuration] = numTypeInfo;
    let amount = numTypeInfo[2];

    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );

    // If base or quote is NFT, use the whole amount of the liquidity
    amount = Market.isNFT(market.baseType) || Market.isNFT(market.quoteType) ? toBigInt(liq.amount) : amount;

    // Create swap
    let swap: Partial<Swap> = {
      network: this.network,
      marketAddress,
      lid: toNumber(lid),
      provider,
      taker: swapper,
      base: market.base,
      baseAddress: market.baseAddress,
      quote: market.quote,
      quoteAddress: market.quoteAddress,
      orderId: toNumber(orderId),
      amount: amount.toString(),
      price: price.toString(),
      offerId: !isZero(offerId) ? toDec(offerId).sub(1).toNumber() : undefined,
      providerIds: idsFromProvider.map((id) => toNumber(id)),
      takerIds: idsFromTaker.map((id) => toNumber(id)),
      operator: toNumber(operator),
      txHash: event.transactionHash,
      cancelAt: moment
        .unix(await getBlockTime(event))
        .add(toNumber(cancelDuration), 'seconds')
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
        amount: toDec(liq.amount).sub(swap.amount).toFixed(),
        totalSwaps: liq.totalSwaps + 1,
      },
      txn,
    );

    // Update market
    market = await Market.updateById(market.id, { totalSwaps: market.totalSwaps + 1 }, txn);

    // Create liquidity event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: toNumber(lid),
        creator: swapper,
        orderId: toNumber(orderId),
        action: Events.LiquiditySwap,
        swapId: swap.id,
      },
      txn,
    );

    // Send notification
    swap.market = market;
    this.notifSrv.notify(NotificationID.NewInteractiveSwap, this.network, provider, <SwapOrderNotificationData>{
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
    numTypeInfo: bigint[],
    byDispute: boolean,
    idsFromProvider: bigint[],
    idsFromTaker: bigint[],
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let [orderId] = numTypeInfo;
    const [, lid, , price, offerId, operator] = numTypeInfo;
    let amount = numTypeInfo[2];

    if (
      this.network === 'base' &&
      isEqualStr(this.cfg.get('app.swapMarket'), marketAddress) &&
      isEqualStr(this.cfg.get('app.swapProvider'), provider)
    ) {
      await User.updateByAddress(swapper, { hasSwapped: true }, txn);
      await User.updateByAddress(provider, { hasSwapped: true }, txn);
    }

    if (isZero(orderId)) {
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
      let liq = await Liquidity.getLiquidity(
        this.network,
        marketAddress,
        provider,
        toNumber(lid),
        undefined,
        undefined,
        txn,
      );

      // If base or quote is NFT, use the whole amount of the liquidity
      amount = Market.isNFT(market.baseType) || Market.isNFT(market.quoteType) ? toBigInt(liq.amount) : amount;

      // Compute USD value of the swap
      const valueUsd = await this.computeSwapUsdValue(market, amount, price);

      // Get USD equivalent of the swap value
      let swap: Partial<Swap> = {
        network: this.network,
        lid: toNumber(lid),
        marketAddress,
        provider,
        taker: swapper,
        base: market.base,
        baseAddress: market.baseAddress,
        quote: market.quote,
        quoteAddress: market.quoteAddress,
        orderId: !isZero(orderId) ? toNumber(orderId) - 1 : undefined,
        amount: amount.toString(),
        valueUsd,
        price: price.toString(),
        instant: isZero(orderId),
        paid: isZero(orderId),
        released: isZero(orderId),
        offerId: !isZero(offerId) ? toDec(offerId).sub(1).toNumber() : undefined,
        operator: toNumber(operator),
        providerIds: idsFromProvider.map((id) => toNumber(id)),
        takerIds: idsFromTaker.map((id) => toNumber(id)),
        txHash: event.transactionHash,
      };
      const info = await this.computeSwapFees(swap, event.blockNumber);
      swap = await Swap.create({ ...swap, ...info }, txn);

      // Update liquidity
      const now = moment().toISOString();
      liq = await Liquidity.updateById(
        liq.id,
        {
          amount: toDec(liq.amount).sub(amount.toString()).toFixed(),
          amountSwapped: toDec(liq.amountSwapped).add(amount.toString()).toFixed(),
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
          amountSwapped: toDec(market.amountSwapped).add(amount.toString()).toFixed(),
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
          lid: toNumber(lid),
          creator: swapper,
          orderId: toNumber(orderId),
          action: Events.LiquiditySwap,
          swapId: swap.id,
        },
        txn,
      );

      // Grant point to the swapper
      // await this.netSrv.pointSrv.grantOnSwap(market, swap as Swap, txn, event);

      // Send notification
      this.notifSrv.notify(NotificationID.NewInstantSwap, this.network, provider, <InstantSwapNotificationData>{
        market,
        swap,
        liq,
      });
    } else {
      orderId = orderId - BigInt(1);
      const now = moment();
      let swap = await Swap.get(this.network, toNumber(orderId), undefined, undefined, txn);
      const { marketAddress, provider } = swap;
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);

      // Compute USD value of the swap
      const valueUsd = await this.computeSwapUsdValue(market, toBigInt(swap.amount), price);

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

      // Mark the last dispute as `orderReleased` if there is any.
      // Complete all draft tasks of the dispute.
      // Create an execution task for the dispute if the dispute was not fully drafted
      const dispute = await Dispute.getRecentOfOrder(this.network, marketAddress, toNumber(orderId), txn);
      if (dispute && !dispute.orderReleased) {
        await Dispute.updateById(dispute.id, { orderReleased: true }, txn);
        await MineTask.completeAllUncompletedDraftTask(this.network, dispute.orderId, dispute.disputeId, txn);
        if (dispute.numMediatorsDrafted < dispute.numMediators) {
          await MineTask.create(
            {
              type: MineTaskType.Execute,
              network: dispute.network,
              marketAddress,
              orderId: dispute.orderId,
              disputeId: dispute.disputeId,
              mineAt: moment().toISOString(),
            },
            txn,
          );
        }
      }

      // Update liquidity
      let liq = await Liquidity.getLiquidity(
        this.network,
        marketAddress,
        provider,
        toNumber(lid),
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
          amountSwapped: toDec(liq.amountSwapped).add(amount.toString()).toFixed(),
          completionRate: dispute ? liq.completionRate : newCompletionRate,
          avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, provider, toNumber(lid), txn),
          avgReleaseDur: await Swap.getAvgReleaseDuration(
            this.network,
            marketAddress,
            provider,
            toNumber(lid),
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
          amountSwapped: toDec(market.amountSwapped).add(amount.toString()).toFixed(),
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
          orderId: toNumber(orderId),
          creator: releaser,
          action: Events.SwapReleased,
        },
        txn,
      );

      // await this.netSrv.pointSrv.grantOnSwap(market, swap as Swap, txn, event);

      // Send notification
      // Send to either taker or provider if one of them is the finalizer.
      // or send to both if neither is the finalizer
      const notifData = { market, liq, swap };
      if (includesStr([swap.provider, swap.taker], swap.finalizer)) {
        this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.getPayer(), notifData);
      } else {
        this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.provider, notifData);
        this.notifSrv.notify(NotificationID.SwapOrderReleased, this.network, swap.taker, notifData);
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
    orderId: bigint,
    canceller: string,
    byDispute: boolean,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const now = moment();

    // Mark swap order as `cancelled`
    let swap = await Swap.get(this.network, toNumber(orderId), undefined, undefined, txn);
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
      amount: toDec(liq.amount).add(swap.amount).toFixed(),
      avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, provider, lid, txn),
    });

    // Update market
    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    market = await Market.updateById(
      market.id,
      {
        avgFinalizeDur: await Swap.getAvgFinalizeDuration(this.network, marketAddress, undefined, undefined, txn),
      },
      txn,
    );

    // Create swap event
    await Event.create(
      {
        network: this.network,
        marketAddress,
        orderId: toNumber(orderId),
        creator: canceller,
        action: Events.SwapCancelled,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('swap:cancelled', this.network, canceller, event, txn);

    // Send notification.
    // Send to either taker or provider if one of them is the canceller.
    // or send to both if neither is the canceller
    swap.market = market;
    const notifData = { market, liq, swap };
    if (includesStr([swap.provider, swap.taker], canceller)) {
      const recipient = swap.provider === canceller ? swap.taker : swap.provider;
      this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, recipient, notifData);
    } else {
      this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, swap.provider, notifData);
      this.notifSrv.notify(NotificationID.SwapOrderCancelled, this.network, swap.taker, notifData);
    }
  }

  /**
   * An order was marked as `paid`
   * @param orderId The order ID
   * @param payer The order payer's address
   * @param disputeDelayDur The duration after which the order can be disputed
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrderPaid(
    orderId: bigint,
    payer: string,
    disputeDelayDur: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let swap = await Swap.get(this.network, toNumber(orderId), undefined, undefined, txn);

    // Update the order
    swap = await Swap.updateById(
      swap.id,
      {
        paid: true,
        payer: payer,
        paidAt: moment().toISOString(),
        disputeFrom: moment
          .unix(await getBlockTime(event))
          .add(toNumber(disputeDelayDur), 'seconds')
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
    let market = await Market.getMarket(this.network, swap.marketAddress, undefined, undefined, true, txn);
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
        orderId: toNumber(orderId),
        creator: swap.payer,
        action: Events.SwapPaid,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('swap:paid', this.network, swap.payer, event, txn);

    // Send notification
    const recipient = swap.payer == swap.provider ? swap.taker : swap.provider;
    this.notifSrv.notify(NotificationID.SwapOrderPaid, this.network, recipient, {
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
    _amount: bigint,
    _convAsset: string,
    _convAmount: bigint,
    event: ContractCallEvent,
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
   * @param syntheticSwapFeeBp The new JOIN swap fee in basis point
   * @param stableSwapFeeBp The new stable asset swap fee in basis point
   * @param fixedSynthSwapFee The new fee for SYNTH/SYNTH swap (in JOIN)
   * @param fixedNFTSwapFee The new fee for NFT/NFT swap (in JOIN)
   * @param instantNFTSwapFeeBp The new fee for NFT/ERC20 swap in basis point
   * @param _event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeUpdated(
    instantSwapFeeBp: bigint,
    syntheticSwapFeeBp: bigint,
    stableSwapFeeBp: bigint,
    fixedSynthSwapFee: bigint,
    fixedNFTSwapFee: bigint,
    instantNFTSwapFeeBp: bigint,
    _event: ContractCallEvent,
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
    lid: bigint,
    ids: bigint[],
    price: bigint,
    wantOrIds: bigint[],
    wantAndIds: bigint[],
    timeToPay: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);

    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketAddress,
          address: makeLiqAddress(marketAddress, provider, toNumber(lid)),
          target,
          paused,
          lid: toNumber(lid),
          base: market.base,
          baseAddress: market.baseAddress,
          baseType: market.baseType,
          quote: market.quote,
          quoteAddress: market.quoteAddress,
          quoteType: market.quoteType,
          ids: ids.map((id) => toNumber(id)),
          price: price.toString(),
          amount: ids.length.toString(),
          wantAndIds: wantAndIds.map((id) => toNumber(id)),
          wantOrIds: wantOrIds.map((id) => toNumber(id)),
          timeToPay: toNumber(timeToPay),
        },
        txn,
      );

      // Update market
      if (!market.hidden) {
        await Market.updateById(
          market.id,
          { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
          txn,
        );
      }
    } else {
      const updates: Partial<Liquidity> = {};

      const _ids = ids.map((id) => toNumber(id));
      if (!_.isEqual(liq.ids, _ids)) {
        if (deduct) updates.ids = _.difference(liq.ids, _ids);
        else updates.ids = _.union(liq.ids, _ids);
        updates.amount = updates.ids.length.toFixed();
      }

      if (liq.target != target) updates.target = target;
      if (liq.paused != paused) updates.paused = paused;
      if (liq.price !== price.toString()) updates.price = price.toString();
      if (liq.timeToPay !== toNumber(timeToPay)) updates.timeToPay = toNumber(timeToPay);

      const _wantAndIds = wantAndIds.map((id) => toNumber(id));
      if (!_.isEqual(liq.wantAndIds, _wantAndIds)) updates.wantAndIds = _wantAndIds;

      const _wantOrIds = wantOrIds.map((id) => toNumber(id));
      if (!_.isEqual(liq.wantOrIds, _wantOrIds)) updates.wantOrIds = _wantOrIds;

      const providerUser = await User.getByAddress(provider, txn);
      if (providerUser && !liq.messagingEnabledUpdatedAt) {
        updates.messagingEnabled = providerUser.messagingEnabled;
        updates.messagingEnabledUpdatedAt = moment().toISOString();
      }

      // Update liquidity
      await Liquidity.updateById(liq.id, updates, txn);

      // Update market
      if (!market.hidden) {
        await Market.updateById(
          market.id,
          { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
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
          baseAddress: market.baseAddress,
          quoteAddress: market.quoteAddress,
          provider,
          lid: toNumber(lid),
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
    lid: bigint,
    amount: bigint,
    price: bigint,
    wantOrIds: bigint[],
    wantAndIds: bigint[],
    minSwap: bigint,
    maxSwap: bigint,
    timeToPay: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );

    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);

    const common = {
      network: this.network,
      marketAddress,
      provider,
      lid: toNumber(lid),
      creator: provider,
    };

    if (!liq) {
      liq = await Liquidity.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: toNumber(lid),
          address: makeLiqAddress(marketAddress, provider, toNumber(lid)),
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
          wantAndIds: wantAndIds.map((id) => toNumber(id)),
          wantOrIds: wantOrIds.map((id) => toNumber(id)),
          minSwap: minSwap.toString(),
          maxSwap: maxSwap.toString(),
          timeToPay: toNumber(timeToPay),
        },
        txn,
      );

      // Update market
      const { id: marketId } = market;
      if (!market.hidden) {
        market = await Market.updateById(
          marketId,
          { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
          txn,
        );
      }

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

      await this.netSrv.pointSrv.grantOnLiquidityUpdate(market, liq, true, provider, amount, txn);
    } else {
      const liqUpdates: Partial<Liquidity> = {};
      const marketUpdates: Partial<Market> = {};

      if (!isZero(amount)) {
        liqUpdates.amount = deduct
          ? toDec(liq.amount).sub(amount.toString()).toFixed()
          : toDec(liq.amount).add(amount.toString()).toFixed();

        const action = deduct ? Events.LiquidityRemove : Events.LiquidityAdd;
        await Event.create({ ...common, amount: amount.toString(), action }, txn);
        await this.netSrv.pointSrv.grantOnLiquidityUpdate(market, liq, !deduct, provider, amount, txn);
      }

      if (liq.target != target) {
        liqUpdates.target = target;
        await Event.create({ ...common, target: liqUpdates.target, action: Events.LiquidityTargetUpdate }, txn);
      }

      if (liq.paused != paused) {
        liqUpdates.paused = paused;
        await Event.create({ ...common, paused: liqUpdates.paused, action: Events.LiquidityPause }, txn);
      }

      if (liq.price !== price.toString()) {
        liqUpdates.price = price.toString();
        await Event.create({ ...common, price: liqUpdates.price, action: Events.LiquidityPriceUpdate }, txn);
      }

      if (liq.minSwap !== minSwap.toString() || liq.maxSwap !== maxSwap.toString()) {
        liqUpdates.minSwap = liq.minSwap !== minSwap.toString() ? minSwap.toString() : undefined;
        liqUpdates.maxSwap = liq.maxSwap !== maxSwap.toString() ? maxSwap.toString() : undefined;
        await Event.create(
          {
            ...common,
            minSwap: liqUpdates.minSwap || liq.minSwap,
            maxSwap: liqUpdates.maxSwap || liq.maxSwap,
            action: Events.LiquiditySwapLimitUpdate,
          },
          txn,
        );
      }

      if (liq.timeToPay !== toNumber(timeToPay)) {
        liqUpdates.timeToPay = toNumber(timeToPay);
        await Event.create(
          { ...common, timeToPay: liqUpdates.timeToPay, action: Events.LiquidityTimeToPayUpdate },
          txn,
        );
      }

      const _wantAndIds = wantAndIds.map((id) => toNumber(id));
      if (!_.isEqual(liq.wantAndIds, _wantAndIds)) liqUpdates.wantAndIds = _wantAndIds;

      const _wantOrIds = wantOrIds.map((id) => toNumber(id));
      if (!_.isEqual(liq.wantOrIds, _wantOrIds)) liqUpdates.wantOrIds = _wantOrIds;

      const providerUser = await User.getByAddress(provider, txn);
      if (providerUser && !liq.messagingEnabledUpdatedAt) {
        liqUpdates.messagingEnabled = providerUser.messagingEnabled;
        liqUpdates.messagingEnabledUpdatedAt = moment().toISOString();
      }

      await Liquidity.updateById(liq.id, liqUpdates, txn);

      if (!market.hidden) {
        marketUpdates.lowestPrice = await Liquidity.getLowestPrice(
          this.network,
          marketAddress,
          undefined,
          undefined,
          txn,
        );
      }

      await Market.updateById(market.id, marketUpdates, txn);
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
          lid: toNumber(lid),
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
    lid: bigint,
    price: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
      undefined,
      'market',
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
        lid: toNumber(lid),
        price: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
      },
      txn,
    );

    // Update market
    if (!liq.market.hidden) {
      await Market.updateByNetworkAddress(this.network, marketAddress, {
        lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
      });
    }

    // Add liquidity event
    if (liq.price != price.toString()) {
      await Event.create(
        {
          network: this.network,
          marketAddress,
          provider,
          lid: toNumber(lid),
          creator: manager,
          price: price.toString(),
          action: Events.LiquidityPriceUpdate,
        },
        txn,
      );
    }

    await this.netSrv.pointSrv.grantPoint('liq:price_updated', this.network, provider, event, txn);
  }

  /**
   * A liquidity pause status was updated
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param lid The liquidity ID
   * @param paused Indicates whether the liquidity has been paused or un-paused
   * @param event The event object
   * @param txn The transaction object
   */
  async onTogglePause(
    marketAddress: string,
    provider: string,
    lid: bigint,
    paused: boolean,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
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
          lid: toNumber(lid),
          creator: provider,
          paused,
          action: Events.LiquidityPause,
        },
        txn,
      );
    }

    await this.netSrv.pointSrv.grantPoint('liq:paused', this.network, provider, event, txn);
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
    _event: ContractCallEvent,
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
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    const notifData = { market, provider };
    if (oldManager != ZeroAddress && !isEqualStr(manager, oldManager)) {
      this.notifSrv.notify(NotificationID.RemoveLiquidityManager, this.network, oldManager, notifData);
    }

    // Notify the new manager
    this.notifSrv.notify(NotificationID.UpdatedLiquidityManager, this.network, manager, notifData);
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
    inventor: bigint,
    shared: bigint,
    operator: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Inventor), inventor.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Shared), shared.toString(), txn);
    await Meta.update(Meta.makeNetKey(this.network, ProtocolFeeBeneficiary.Operator), operator.toString(), txn);
  }

  /**
   * NFT Discount basis point was updated
   * @param _discountBp The discount basis point
   * @param _event The event object
   * @param _txn The transaction object
   * @deprecated
   */
  async onNFTDiscountUpdated(_discountBp: bigint, _event: ContractCallEvent, _txn?: Transaction) {
    // TODO: Implement
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
    lid: bigint,
    offerer: string,
    offerId: bigint,
    amount: bigint,
    price: bigint,
    ids: bigint[],
    expireDuration: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    // Save the offer
    const offer = await Offer.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: toNumber(lid),
        offerId: toDec(offerId).sub(1).toNumber(),
        creator: offerer,
        amount: amount.toString(),
        price: price.toString(),
        ids: ids.map((id) => toNumber(id)),
        deadline: moment
          .unix(await getBlockTime(event))
          .add(toNumber(expireDuration), 'seconds')
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
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );
    await Event.create(
      {
        network: this.network,
        marketAddress,
        provider,
        lid: toNumber(lid),
        creator: offerer,
        offerId: offer.offerId,
        action: Events.LiquidityOffer,
      },
      txn,
    );

    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);

    // await this.netSrv.pointSrv.grantPoint('offer:created', this.network, offerer, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.NewOffer, this.network, provider, {
    //   market,
    //   liq,
    //   offer,
    // });
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
    offerId: bigint,
    offerer: string,
    amount: bigint,
    price: bigint,
    ids: bigint[],
    expireDuration: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const offer = await Offer.updateByOfferId(
      toNumber(offerId),
      {
        amount: amount.toString(),
        price: price.toString(),
        ids: ids.map((id) => toNumber(id)),
        accepted: false,
        deadline: moment
          .unix(await getBlockTime(event))
          .add(toNumber(expireDuration), 'seconds')
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

    // const { marketAddress, provider, lid } = offer;
    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    // const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // await this.netSrv.pointSrv.grantPoint('offer:updated', this.network, offerer, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.OfferUpdated, this.network, offer.provider, {
    //   updated: true,
    //   market,
    //   liq,
    //   offer,
    // });
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
    offerId: bigint,
    acceptor: string,
    execDelayDur: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, toNumber(offerId), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(
      toNumber(offerId),
      {
        accepted: true,
        execAt: moment
          .unix(await getBlockTime(event))
          .add(toNumber(execDelayDur), 'seconds')
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

    // const { marketAddress, provider, lid } = offer;
    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    // const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // await this.netSrv.pointSrv.grantPoint('offer:accepted', this.network, acceptor, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.OfferAccepted, this.network, offer.creator, {
    //   offer,
    //   liq,
    //   market,
    // });
  }

  /**
   * Offer was unaccepted
   * @param offerId The offer ID
   * @param unacceptor The offer unacceptor's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferUnaccepted(offerId: bigint, unacceptor: string, event: ContractCallEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, toNumber(offerId), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(toNumber(offerId), { accepted: false, execAt: null }, txn);

    const { marketAddress } = offer;
    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    // const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

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

    // await this.netSrv.pointSrv.grantPoint('offer:unaccepted', this.network, unacceptor, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.OfferUnaccepted, this.network, offer.creator, {
    //   offer,
    //   liq,
    //   market,
    // });
  }

  /**
   * Offer was cancelled
   * @param offerId The offer ID
   * @param canceller The offer canceller's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferCancelled(offerId: bigint, canceller: string, event: ContractCallEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, toNumber(offerId), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(toNumber(offerId), { cancelled: true }, txn);

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

    // const { marketAddress, provider, lid } = offer;
    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    // const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // await this.netSrv.pointSrv.grantPoint('offer:cancelled', this.network, canceller, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.OfferCancelled, this.network, offer.provider, {
    //   offer,
    //   liq,
    //   market,
    // });
  }

  /**
   * Offer was unaccepted
   * @param offerId The offer ID
   * @param executor The offer executor's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferExecuted(offerId: bigint, executor: string, event: ContractCallEvent, txn?: Transaction) {
    let offer = await Offer.getByNetworkAndOfferId(this.network, toNumber(offerId), undefined, undefined, txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(toNumber(offerId), { executed: true }, txn);

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

    // const { marketAddress, provider, lid } = offer;
    // const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);
    // const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, undefined, txn);

    // await this.netSrv.pointSrv.grantPoint('offer:executed', this.network, executor, event, txn);

    // Send notification
    // this.notifSrv.notify(NotificationID.OfferExecuted, this.network, offer.provider, {
    //   offer,
    //   market,
    //   liq,
    // });
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
    lid: bigint,
    badges: [string, string][],
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Liquidity.update(
      this.network,
      marketAddress,
      provider,
      toNumber(lid),
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
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: ContractCallEvent, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}

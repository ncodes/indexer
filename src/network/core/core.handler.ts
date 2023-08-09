import { Logger } from '@nestjs/common';
import { BigNumber, constants, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import { Handler } from '../handler';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import Swap from '../../models/swap';
import Meta, { FeeName, ProtocolFeeBeneficiary } from '../../models/meta';
import NetworkService from '../network.service';
import Market from '../../models/market';
import * as moment from 'moment';
import { toBN } from '../common';
import Dispute from '../../models/dispute';
import MineTask, { MineTaskType } from '../../models/mine_task';
import * as _ from 'lodash';
import Offer from '../../models/offers';
import { includesStr, isEqualStr } from '../../common/common';

export class CoreHandler extends Handler {
  logger = new Logger(CoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
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
        event: Event,
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
        event: Event,
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
      async (orderId: BigNumber, canceller: string, byDispute: boolean, event: Event, txn?: Transaction) => {
        return this.onOrderCancelled(orderId, canceller, byDispute, event, txn);
      },
    );

    this.on('SwapOrderPaid', async (orderId: BigNumber, disputeFrom: BigNumber, event: Event, txn?: Transaction) => {
      return this.onSwapOrderPaid(orderId, disputeFrom, event, txn);
    });

    this.on(
      'TransferredToFeePool',
      async (
        token: string,
        amount: BigNumber,
        convAsset: string,
        convAmount: BigNumber,
        event: Event,
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
        event: Event,
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
        event: Event,
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
        event: Event,
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
        event: Event,
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
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquidityManager(marketAddress, provider, manager, oldManager, event, txn);
      },
    );

    this.on(
      'ProtocolFeeSplitUpdated',
      async (inventor: BigNumber, shared: BigNumber, operator: BigNumber, event: Event, txn?: Transaction) => {
        return this.onProtocolFeeSplitUpdated(inventor, shared, operator, event, txn);
      },
    );

    this.on('NFTDiscountUpdated', async (discountBp: BigNumber, event: Event, txn?: Transaction) => {
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
        deadline: BigNumber,
        event: Event,
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
          deadline,
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
        deadline: BigNumber,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onOfferUpdated(offerId, offerer, amount, price, ids, deadline, event, txn);
      },
    );

    this.on(
      'OfferAccepted',
      async (offerId: BigNumber, acceptor: string, execAt: BigNumber, event: Event, txn?: Transaction) => {
        return this.onOfferAccepted(offerId, acceptor, execAt.toNumber(), event, txn);
      },
    );

    this.on('OfferCancelled', async (offerId: BigNumber, canceller: string, event: Event, txn?: Transaction) => {
      return this.onOfferCancelled(offerId, canceller, event, txn);
    });

    this.on('OfferUnaccepted', async (offerId: BigNumber, unacceptor: string, event: Event, txn?: Transaction) => {
      return this.onOfferUnaccepted(offerId, unacceptor, event, txn);
    });

    this.on('OfferExecuted', async (offerId: BigNumber, executor: string, event: Event, txn?: Transaction) => {
      return this.onOfferExecuted(offerId, executor, event, txn);
    });

    this.on(
      'UpdatedLiquiditySwapBadges',
      async (
        marketAddress: string,
        provider: string,
        lid: BigNumber,
        badges: [string, string][],
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onUpdatedLiquiditySwapBadges(marketAddress, provider, lid, badges, event, txn);
      },
    );

    this.on('UpdatedMinTimeToPay', async (value: BigNumber, event: Event, txn?: Transaction) => {
      return this.onParameterUpdate('minTimeToPay', value.toString(), event, txn);
    });

    this.on('UpdatedOrderGraceDur', async (value: BigNumber, event: Event, txn?: Transaction) => {
      return this.onParameterUpdate('orderGraceDur', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenOrders', async (value: BigNumber, event: Event, txn?: Transaction) => {
      return this.onParameterUpdate('maxOpenOrders', value.toString(), event, txn);
    });

    this.on('UpdatedMaxOpenDisputes', async (value: BigNumber, event: Event, txn?: Transaction) => {
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
   * Handle new swap order
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param swapper The order creator (taker)
   * @param recipient An alternative recipient of the swapper's base asset
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
    recipient: string,
    numTypeInfo: BigNumber[],
    idsFromProvider: BigNumber[],
    idsFromTaker: BigNumber[],
    event: Event,
    txn?: Transaction,
  ) {
    const [orderId, lid, , price, offerId, operator, cancelAt] = numTypeInfo;
    let amount = numTypeInfo[2];

    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);

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
      offerId: offerId.toNumber(),
      providerIds: idsFromProvider.map((id) => id.toNumber()),
      takerIds: idsFromTaker.map((id) => id.toNumber()),
      operator: operator.toNumber(),
      txHash: event.transactionHash,
      cancelAt: moment.unix(cancelAt.toNumber()).toISOString(),
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
    swap.market = market;

    // Send notification
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
   * @param recipient An alternative recipient of the swapper's base asset
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
    recipient: string,
    releaser: string,
    numTypeInfo: BigNumber[],
    byDispute: boolean,
    idsFromProvider: BigNumber[],
    idsFromTaker: BigNumber[],
    event: Event,
    txn?: Transaction,
  ) {
    const [orderId, lid, , price, offerId, operator] = numTypeInfo;
    let amount = numTypeInfo[2];

    if (orderId.isZero()) {
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
      let liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);

      // If base or quote is NFT, use the whole amount of the liquidity
      amount = Market.isNFT(market.baseType) || Market.isNFT(market.quoteType) ? toBN(liq.amount) : amount;

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
        price: price.toString(),
        instant: orderId.isZero(),
        paid: orderId.isZero(),
        released: orderId.isZero(),
        offerId: offerId.toNumber(),
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

      // Send notification
      await this.notifSrv.notify(NotificationID.NewInstantSwap, this.network, provider, <InstantSwapNotificationData>{
        market,
        swap,
        liq,
      });
    } else {
      const now = moment();
      let swap = await Swap.get(this.network, orderId.toNumber() - 1, undefined, txn);

      // Update the swap
      swap = await Swap.updateById(
        swap.id,
        {
          released: true,
          byDispute,
          finalizer: releaser,
          finalizedAt: now.toISOString(),
        },
        txn,
      );

      // Mark the last dispute as `orderReleased` if there is any
      const { marketAddress, provider } = swap;
      const dispute = await Dispute.getRecentOfOrder(this.network, marketAddress, orderId.toNumber() - 1, txn);
      if (dispute && !dispute.orderReleased) {
        await Dispute.updateById(dispute.id, { orderReleased: true }, txn);
      }

      // Update liquidity
      let liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);
      let newCompletionRate = await Swap.getCompletionRate(this.network, marketAddress, provider, txn);
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
      let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
      newCompletionRate = await Swap.getCompletionRate(this.network, marketAddress, undefined, txn);
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
   * @param event The event object
   * @param txn The transaction object
   */
  async onOrderCancelled(orderId: BigNumber, canceller: string, byDispute: boolean, event: Event, txn?: Transaction) {
    const now = moment();

    // Mark swap order as `cancelled`
    let swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);
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
    let liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);
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
   * @param disputeFrom The time after which the order can be disputed
   * @param event The event object
   * @param txn The transaction object
   */
  async onSwapOrderPaid(orderId: BigNumber, disputeFrom: BigNumber, event: Event, txn?: Transaction) {
    let swap = await Swap.get(this.network, orderId.toNumber(), undefined, txn);

    // Update the order
    swap = await Swap.updateById(
      swap.id,
      {
        paid: true,
        payer: swap.getPayer(),
        paidAt: moment().toISOString(),
        disputeFrom: moment.unix(disputeFrom.toNumber()).toISOString(),
      },
      txn,
    );

    // Update liquidity
    const { marketAddress, provider, lid } = swap;
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);
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
   * @param amount The amount that was transferred
   * @param convAsset The asset the fee was converted to
   * @param convAmount The amount after conversion
   * @param event The event object
   * @param txn The transaction object
   */
  async onTransferredToFeePool(
    token: string,
    amount: BigNumber,
    convAsset: string,
    convAmount: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    // Add a task for the future
    const block = await event.getBlock();
    const mineAt = block.timestamp + parseInt(await Meta.getContractParam(this.network, 'transferToFeePoolInterval'));
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
   * @param event The event object
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
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);

    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketAddress,
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

      await Liquidity.updateById(liq.id, upd, txn);
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
   * Non-fungible market liquidity was updated
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
   * @param event The event object
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
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);

    if (!liq) {
      await Liquidity.create(
        {
          network: this.network,
          provider,
          marketAddress,
          target,
          paused,
          lid: lid.toNumber(),
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

      await Market.updateById(
        market.id,
        {
          totalLiquidity: toBN(market.totalLiquidity).add(amount).toString(),
          lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn),
        },
        txn,
      );
    } else {
      const ch: Partial<Liquidity> = {};
      const mktCh: Partial<Market> = {};

      if (liq.amount !== amount.toString()) {
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
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedPrice(
    marketAddress: string,
    provider: string,
    manager: string,
    lid: BigNumber,
    price: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);

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
    lid: BigNumber,
    paused: boolean,
    event: Event,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);
    await Liquidity.updateById(liq.id, { paused });
    return;
  }

  /**
   * Liquidity manager was updated for a liquidity
   * @param marketAddress The market ID
   * @param provider The liquidity provider's address
   * @param manager The new liquidity manager's address
   * @param oldManager The old liquidity manager's address
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedLiquidityManager(
    marketAddress: string,
    provider: string,
    manager: string,
    oldManager: string,
    event: Event,
    txn?: Transaction,
  ) {
    if (isEqualStr(manager, oldManager)) return;

    await Liquidity.update(this.network, marketAddress, provider, undefined, { manager }, txn);

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
   * @param event The event object
   * @param txn The transaction object
   */
  async onProtocolFeeSplitUpdated(
    inventor: BigNumber,
    shared: BigNumber,
    operator: BigNumber,
    event: Event,
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
  async onNFTDiscountUpdated(discountBp: BigNumber, event: Event, txn?: Transaction) {
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
   * @param deadline The offer deadline
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
    deadline: BigNumber,
    event: Event,
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
        deadline: moment.unix(deadline.toNumber()).toISOString(),
      },
      txn,
    );

    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid.toNumber(), undefined, txn);

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
   * @param deadline The updated deadline
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferUpdated(
    offerId: BigNumber,
    offerer: string,
    amount: BigNumber,
    price: BigNumber,
    ids: BigNumber[],
    deadline: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    const offer = await Offer.updateByOfferId(
      offerId.toNumber(),
      {
        amount: amount.toString(),
        price: price.toString(),
        ids: ids.map((id) => id.toNumber()),
        accepted: false,
        deadline: moment.unix(deadline.toNumber()).toISOString(),
      },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);

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
   * @param execAt The time when the offer can be executed
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferAccepted(offerId: BigNumber, acceptor: string, execAt: number, event: Event, txn?: Transaction) {
    let offer = await Offer.getByOfferId(offerId.toNumber(), txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(
      offerId.toNumber(),
      { accepted: true, execAt: moment.unix(execAt).toISOString() },
      txn,
    );

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);

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
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferUnaccepted(offerId: BigNumber, unacceptor: string, event: Event, txn?: Transaction) {
    let offer = await Offer.getByOfferId(offerId.toNumber(), txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { accepted: false, execAt: null }, txn);

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);

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
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferCancelled(offerId: BigNumber, canceller: string, event: Event, txn?: Transaction) {
    let offer = await Offer.getByOfferId(offerId.toNumber(), txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { cancelled: true }, txn);

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);

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
   * @param event The event object
   * @param txn The transaction object
   */
  async onOfferExecuted(offerId: BigNumber, executor: string, event: Event, txn?: Transaction) {
    let offer = await Offer.getByOfferId(offerId.toNumber(), txn);
    if (!offer) throw new Error('Offer not found');

    // Update the offer
    offer = await Offer.updateByOfferId(offerId.toNumber(), { executed: true }, txn);

    const { marketAddress, provider, lid } = offer;
    const market = await Market.getMarket(this.network, marketAddress, undefined, undefined, txn);
    const liq = await Liquidity.getLiquidity(this.network, marketAddress, provider, lid, undefined, txn);

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
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedLiquiditySwapBadges(
    marketAddress: string,
    provider: string,
    lid: BigNumber,
    badges: [string, string][],
    event: Event,
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
   * @param event The event object
   * @param txn The transaction object
   */
  async onParameterUpdate(param: keyof ContractsParams, value: string, event: Event, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}

import { Body, Controller, Get, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import { ConfigService } from '../../config/config.service';
import Event, { EventActionClass } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketService } from '../markets/market.service';
import SwapService from '../swaps/swap.service';
import { LiquidityService } from './liquidity.service';
import { FillParamDTO, FillQueryDTO, GetParamDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import { isEqualStr, toDec } from '../../common/common';
import { FeeCalculatorService } from '../../services/fee_calculator.service';
import { toHD, toLD } from '../../network/common';

@Controller('v1/liquidities')
export class LiquidityController {
  constructor(
    private liqSrv: LiquidityService,
    private mktSrv: MarketService,
    private cfgSrv: ConfigService,
    private metadataSrv: MetadataService,
    private swapSrv: SwapService,
    private feeCalcSrv: FeeCalculatorService,
  ) {}

  /**
   * Generate fill information for an amount
   * @param p The param object
   * @param p.mid The market ID
   * @param p.amount The amount corresponding to the side (Quote or Base)
   * @param q The query object
   * @param [q.net] The network name
   */
  @Get(':mid/:amount/:side/fill')
  async fill(
    @Param(new ValidationPipe(ValPipeOpt)) p: FillParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: FillQueryDTO,
  ) {
    const market = await Market.getMarket(q.net, p.mid);
    if (!market) throw404('market not found');

    const { baseDecimals, quoteDecimals } = market;

    const fillInfo = await Liquidity.fill(market, p.side, p.amount);

    let totalQtyFilledAfterFees = toDec(0);
    let totalProtoFee = toDec(0);
    let totalMktFee = toDec(0);
    let protoFeePct = toDec(0);
    let mktFeePct = toDec(0);
    for (const liq of fillInfo.liquidities) {
      const fees = await this.feeCalcSrv.calculateFee({
        network: q.net,
        marketAddress: p.mid,
        provider: liq.provider,
        taker: q.taker,
        orderAmount: liq.amountFilled,
        orderPrice: liq.price,
      });

      const { protoFee, mktCreatorFee, feeBp, mktFeeBp } = fees;
      liq.protoFee = protoFee;
      liq.mktCreatorFee = mktCreatorFee;
      totalProtoFee = totalProtoFee.add(toDec(protoFee));
      totalMktFee = totalMktFee.add(toDec(mktCreatorFee));
      protoFeePct = toDec(feeBp).div(100);
      mktFeePct = toDec(mktFeeBp).div(100);

      if (p.side === 'quote') {
        liq.quantityFilledAfterFees = toDec(liq.quantityFilled).sub(toDec(protoFee).add(mktCreatorFee)).toFixed();
      }

      if (p.side === 'base') {
        const totalFeePct = protoFeePct.add(mktFeePct).div(100);
        const amtHD = toHD(p.amount, baseDecimals);
        const priceHD = toHD(liq.price, quoteDecimals);
        const newQuantity = toDec(amtHD).div(toDec(1).sub(totalFeePct)).mul(priceHD);
        liq.quantityFilledAfterFees = toLD(newQuantity.toFixed(), quoteDecimals).toFixed();
      }

      totalQtyFilledAfterFees = totalQtyFilledAfterFees.add(liq.quantityFilledAfterFees);
    }

    fillInfo.totalQuantityFilledAfterFees = totalQtyFilledAfterFees.toFixed();
    fillInfo.totalProtoFee = totalProtoFee.toFixed();
    fillInfo.totalMktFee = totalMktFee.toFixed();
    fillInfo.totalFees = toDec(fillInfo.totalProtoFee).add(fillInfo.totalMktFee).toFixed();
    fillInfo.protoFeePct = protoFeePct.toNumber();
    fillInfo.mktFeePct = mktFeePct.toNumber();

    return ok().data(fillInfo).build();
  }

  /**
   * Get a liquidity
   * @param p The param object
   * @param p.mid The market ID
   * @param p.provider The provider address
   * @param p.lid The liquidity ID
   * @param q The query object
   * @param q.net The network name
   * @param [q.select] Select fields to return
   */
  @Get('/:mid/:provider/:lid')
  async get(
    @Param(new ValidationPipe(ValPipeOpt)) p: GetParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const liquidity = await Liquidity.getLiquidity(q.net, p.mid, p.provider, p.lid, q.select, 'market');
    if (!liquidity) return throw404('liquidity not found');
    await this.liqSrv.extendLiquidity(liquidity, q.select);
    await this.mktSrv.extendMarket(liquidity.market, ['quoteLogo', 'baseLogo']);
    return ok().data(liquidity).build<Liquidity>();
  }

  /**
   * Get liquidity events
   * @param p The param object
   * @param p.mid The market ID
   * @param p.provider The provider address
   * @param p.lid The liquidity ID
   * @param q The query object
   * @param q.net The network name
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   */
  @Get('/:mid/:provider/:lid/events')
  async events(
    @Param(new ValidationPipe(ValPipeOpt)) p: GetParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const events = await Event.search(
      EventActionClass.Liquidity,
      q.net,
      p.mid,
      p.provider,
      p.lid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      q.limit || 25,
      q.offset,
    );

    for (const event of events) {
      if (event.swap) {
        this.swapSrv.extendSwap(event.swap, ['cost']);
      }
    }

    return ok().data(events).build<Liquidity>();
  }

  /**
   * List liquidities on a network
   * @param q The query object
   * @param q.net The network name
   * @param [q.market] The market ID
   * @param [q.provider] The provider address
   * @param [q.base] The base token address
   * @param [q.quote] The quote token address
   * @param [q.liquidities] The list of liquidities to limit query to
   * @param [q.amount] Filter by minimum swap amount (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.amountUsd] Filter by minimum swap amount in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.price] Filter by price (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.priceUsd] Filter by price in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.kycLp] Indicate to only return liquidity where LPs has KYC badge
   * @param [q.kycTaker] Indicate to only return liquidity where taker has KYC badge
   * @param [q.swapBadges] Indicate to only return liquidity where taker has the specified badge(s)
   * @param [q.count] Returns the count of matching result
   * @param [q.isProvider] If set, the provider is the caller (disables maxOpenDisputes and maxOpenOrders filters)
   * @param [q.paused] If set, only paused liquidities are returned
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   * @param [q.select] Select extend fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    let maxOpenDisputes = (await this.cfgSrv.getContractParam(q.net, 'maxOpenDisputes')) as number;
    let maxOpenOrders = (await this.cfgSrv.getContractParam(q.net, 'maxOpenOrders')) as number;
    if (q.isProvider && q.provider) {
      maxOpenDisputes = 0;
      maxOpenOrders = 0;
    }

    const reqLpBadges = [];
    if (q.kycLp) {
      reqLpBadges.push(this.cfgSrv.get('app.badges.kyc'));
      reqLpBadges.push(this.cfgSrv.get('app.badges.kyc') + '/%');
    }

    const reqSwapBadges = [];
    if (q.kycTaker) {
      reqSwapBadges.push(this.cfgSrv.get('app.badges.kyc'));
      reqSwapBadges.push(this.cfgSrv.get('app.badges.kyc') + '/%');
    }

    if (q.swapBadges) {
      reqSwapBadges.push(...q.swapBadges);
    }

    let baseUsdRate: number;
    let quoteUsdRate: number;
    if (q.amountUsd || q.priceUsd) {
      if (!q.market) return throw400(`'amountUsd' and 'priceUsd' filters require 'market' to be set`);

      const market = await Market.getMarket(q.net, q.market);
      if (!market) return throw404('market not found');

      baseUsdRate = q.amountUsd
        ? await this.metadataSrv.tryToUsd(q.net, '1', market.baseAddress, { refetch: true, isHD: true })
        : undefined;

      quoteUsdRate = q.priceUsd
        ? await this.metadataSrv.tryToUsd(q.net, '1', market.quoteAddress, { refetch: true, isHD: true })
        : undefined;
    }

    if (!q.count) {
      let liquidities = await Liquidity.search({
        network: q.net,
        marketAddress: q.market,
        base: q.base,
        quote: q.quote,
        provider: q.provider,
        paused: q.paused,
        maxOpenDisputes,
        maxOpenOrders,
        amount: q.amount,
        price: q.price,
        amountUsd: q.amountUsd,
        priceUsd: q.priceUsd,
        quoteUsdRate: quoteUsdRate,
        baseUsdRate: baseUsdRate,
        reqLpBadges: reqLpBadges,
        reqSwapBadges: reqSwapBadges,
        paymentMethods: q.paymentMethods,
        liquidities: q.liquidities,
        limit: Math.min(q.limit || 25, 50),
        offset: q.offset,
        select: q.select,
        hidden: false,
      });

      // TODO: remove
      // IDO market should only return IDO liquidity
      if (q.market && isEqualStr(q.market, '0xEEA2f6BEed812f17a3A0dB2B93c7e8EdA44cA97E')) {
        liquidities = liquidities.filter((l) => {
          return isEqualStr(l.provider, '0xAEA70653A241c7a02BB3624935c51f052390A077');
        });
      }

      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, q.select);
        await this.mktSrv.extendMarket(liquidity.market, ['quoteLogo', 'baseLogo']);
      }

      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({
          count: await Liquidity.countLiquidities(q.net, q.market, q.provider, maxOpenDisputes),
        })
        .build();
    }
  }

  // Like list() but with a POST body.
  // Specifically, for passing arrays of liquidities for the 'liquidities' filter.
  @Post()
  async listPost(@Body(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    return this.list(q);
  }
}

import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { isEqualStr, toDec } from '../../common/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw401, throw404 } from '../../common/responses/responses';
import { ConfigService } from '../../config/config.service';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Event, { EventActionClass } from '../../models/event';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import PaymentMethod from '../../models/payment_method';
import { FeeCalculatorService } from '../../services/fee_calculator.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketService } from '../markets/market.service';
import SwapService from '../swaps/swap.service';
import { FillParamDTO, FillQueryDTO, GetParamDTO, GetQueryDTO, ListQueryDTO, UpdateLiquidityDTO } from './dto';
import { LiquidityService } from './liquidity.service';

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
  @Get('/:mid/:amount/:side/fill')
  async fill(
    @Param(new ValidationPipe(ValPipeOpt)) p: FillParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: FillQueryDTO,
  ) {
    const market = await Market.getMarket(q.net, p.mid);
    if (!market) throw404('market not found');

    // Do a dummy fee calculation to get the protocol and market creator fees percentages
    const fees = await this.feeCalcSrv.calculateFee({ network: q.net, marketAddress: p.mid });
    const totalFeesPct = toDec(fees.feeBp).add(fees.mktFeeBp).div(100);

    // Fetch liquidities from the market that can fill the requested amount
    const fillRes = await Liquidity.fill(market, p.side, p.amount, totalFeesPct.toNumber());

    // Calculate actual fees for each liquidity
    let totalQtyFilledAfterFees = toDec(0);
    let totalProtoFee = toDec(0);
    let totalMktFee = toDec(0);
    let protoFeePct = toDec(0);
    let mktFeePct = toDec(0);
    let i = 0;

    for (const liq of fillRes.liquidities) {
      const { protoFee, mktCreatorFee, feeBp, mktFeeBp } = await this.feeCalcSrv.calculateFee({
        network: q.net,
        marketAddress: p.mid,
        orderAmount: liq.amountFilled,
        orderPrice: liq.price,
      });

      liq.protoFee = protoFee;
      liq.mktCreatorFee = mktCreatorFee;
      liq.quantityFilledAfterFees =
        p.side === 'quote'
          ? toDec(liq.quantityFilled).sub(toDec(protoFee).add(mktCreatorFee)).toFixed()
          : liq.quantityFilled;

      // For non-synth markets, all liquidities contribute to the total fees
      // but for synth markets only the first liquidity fee is important as only
      // one liquidity is used to fill the order. In this case, the first liquidity
      // is the one that will be consumed first, so we return fee information for it.
      if (!market.isInteractive() || i === 0) {
        protoFeePct = toDec(feeBp).div(100);
        mktFeePct = toDec(mktFeeBp).div(100);
        totalProtoFee = totalProtoFee.add(toDec(protoFee));
        totalMktFee = totalMktFee.add(toDec(mktCreatorFee));
        totalQtyFilledAfterFees = totalQtyFilledAfterFees.add(liq.quantityFilledAfterFees);
      }

      i++;
    }

    fillRes.totalQuantityFilledAfterFees = totalQtyFilledAfterFees.toFixed();
    fillRes.totalProtoFee = totalProtoFee.toFixed(0);
    fillRes.totalMktFee = totalMktFee.toFixed(0);
    fillRes.totalFees = toDec(fillRes.totalProtoFee).add(fillRes.totalMktFee).toFixed();
    fillRes.protoFeePct = protoFeePct.toNumber();
    fillRes.mktFeePct = mktFeePct.toNumber();

    return ok().data(fillRes).build();
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

  /**
   * Update the payment method ID for a liquidity
   * @param marketAddress The market address
   * @param provider The provider address
   * @param liquidityId The liquidity ID
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/:id/payment-method')
  async updatePaymentMethodId(
    @Req() req: Request,
    @Param('id') liqId: string,
    @Body(new ValidationPipe(ValPipeOpt)) body: UpdateLiquidityDTO,
  ) {
    let liquidity = await Liquidity.getById(liqId);
    if (!liquidity) return throw404('liquidity not found');

    if (liquidity.provider != req.user.address) throw401('not permitted to update this liquidity');

    const pm = await PaymentMethod.getById(body.pmId);
    if (!pm) return throw404('payment method not found');

    liquidity = await Liquidity.updateById(liqId, { paymentMethodId: body.pmId });
    return ok().data(liquidity).build();
  }
}

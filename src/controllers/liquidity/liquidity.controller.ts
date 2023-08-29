import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import Liquidity from '../../models/liquidity';
import { LiquidityService } from './liquidity.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetParamDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import { ConfigService } from '../../config/config.service';
import Event from '../../models/event';
import { MetadataService } from '../../services/metadata/metadata.service';
import Market from '../../models/market';
import { MarketService } from '../markets/market.service';

@Controller('v1/liquidities')
export class LiquidityController {
  constructor(
    private liqSrv: LiquidityService,
    private mktSrv: MarketService,
    private cfgSrv: ConfigService,
    private metadataSrv: MetadataService,
  ) {}

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
   * @param [q.amount] Filter by minimum swap amount (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.amountUsd] Filter by minimum swap amount in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.price] Filter by price (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.priceUsd] Filter by price in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.kycLp] Indicate to only return liquidity where LPs has KYC badge
   * @param [q.kycTaker] Indicate to only return liquidity where taker has KYC badge
   * @param [q.swapBadges] Indicate to only return liquidity where taker has the specified badge(s)
   * @param [q.count] Returns the count of matching result
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   * @param [q.select] Select extend fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const maxOpenDisputes = parseInt(await this.cfgSrv.getContractParam(q.net, 'maxOpenDisputes'));

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
      const liquidities = await Liquidity.search(
        q.net,
        q.market,
        q.base,
        q.quote,
        q.provider,
        maxOpenDisputes,
        q.amount,
        q.price,
        q.amountUsd,
        q.priceUsd,
        quoteUsdRate,
        baseUsdRate,
        reqLpBadges,
        reqSwapBadges,
        q.limit || 25,
        q.offset,
        q.select,
        undefined,
      );

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
}

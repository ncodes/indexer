import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { isProd } from '../../common/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import Market from '../../models/market';
import LiquidityProvider from '../../models/market_provider';
import PermittedTrader from '../../models/permitted_trader';
import Swap from '../../models/swap';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketService } from './market.service';
import {
  GetQueryDTO,
  GetTopMarketsQueryDTO,
  ListPermittedProviderQueryDTO,
  ListPermittedTradersQueryDTO,
  ListQueryDTO,
} from './query.dto';

@Controller('v1/markets')
export class MarketsController {
  constructor(private marketSrv: MarketService, private cfgSrv: ConfigService, private metadataSrv: MetadataService) {}

  // Get top markets
  @Get('/top')
  async top(@Query(new ValidationPipe(ValPipeOpt)) q: GetTopMarketsQueryDTO) {
    const markets = await Swap.getTopMarketBy24hUSDVolume(
      q.net,
      undefined,
      undefined,
      undefined,
      isProd() ? 1440 : 0,
      undefined,
      q.limit || 10,
    );

    for (const m of markets) {
      await this.marketSrv.extendMarket(m, undefined);
    }

    return ok().data(markets).build();
  }

  /**
   * Get a market
   * @param marketAddress The market ID
   * @param q The query object
   * @param [q.net] The network where it exists
   * @param [q.select] Select extend fields to return
   * @returns
   */
  @Get(':mid')
  async get(@Param('mid') marketAddress: string, @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const market = await Market.getMarket(q.net, marketAddress, q.select, undefined);
    if (!market) throw404('market not found');
    await this.marketSrv.extendMarket(market, q.select);
    return ok().data(market).build();
  }

  /**
   * List markets
   * @param q The query object
   * @param [q.net] The network name
   * @param [q.creator] Filter the result by creator address
   * @param [q.address] Filter the result by one or more market address
   * @param [q.regions] Filter the result by one or more region
   * @param [q.base] The base asset address or symbol
   * @param [q.quote] The base asset address or symbol
   * @param [q.permSwap] Indicate to either return permissioned or non-permissioned markets
   * @param [q.instant] Indicate to only return market where base and quote asset are on-chain (instant swap)
   * @param [q.merchantLp] Indicate to only return market where LPs require merchant badge
   * @param [q.kycLp] Indicate to only return market where LPs require KYC badge
   * @param [q.kycTaker] Indicate to only return market where takers require KYC badge
   * @param [q.offer] Indicate to return offer-only markets
   * @param [q.putBadges] Indicate to return markets that require LPs to have these badges
   * @param [q.swapBadges] Indicate to return markets that require takers to have these badges
   * @param [q.query] Filter by a query string
   * @param [q.price] Filter by price (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.liquidity] Filter by liquidity (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.count] Returns the count of markets only
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   * @param [q.select] Select fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const reqPutBadges = [];
    const reqSwapBadges = [];

    if (q.merchantLp) {
      reqPutBadges.push(this.cfgSrv.get('app.badges.merchant'));
    }

    if (q.kycLp) {
      reqPutBadges.push(this.cfgSrv.get('app.badges.kyc'));
    }

    if (q.kycTaker) {
      reqSwapBadges.push(this.cfgSrv.get('app.badges.kyc'));
    }

    if (q.putBadges && q.putBadges.length) {
      reqPutBadges.push(...q.putBadges);
    }

    if (q.swapBadges && q.swapBadges.length) {
      reqSwapBadges.push(...q.swapBadges);
    }

    if (q.liquidityUsd && !q.base) return throw400(`'liquidityUsd' filter requires 'base' to be set`);
    const baseUsdRate = q.base
      ? await this.metadataSrv.tryToUsd(q.net, '1', q.base, { refetch: true, isHD: true })
      : undefined;

    if (q.priceUsd && !q.quote) return throw400(`'priceUsd' filter requires 'quote' to be set`);
    const quoteUsdRate = q.quote
      ? await this.metadataSrv.tryToUsd(q.net, '1', q.quote, { refetch: true, isHD: true })
      : undefined;

    let now = moment();
    const result = await Market.search({
      network: q.net,
      creator: q.creator,
      address: q.address,
      base: q.base,
      quote: q.quote,
      queryStr: q.query,
      price: q.price,
      liquidity: q.liquidity,
      baseUsdRate,
      quoteUsdRate,
      priceUsd: q.priceUsd,
      liquidityUsd: q.liquidityUsd,
      regions: q.regions,
      reqPutBadges,
      reqSwapBadges,
      offer: q.offer,
      permSwap: q.permSwap,
      permPut: q.permPut,
      instant: q.instant,
      countOnly: q.count,
      limit: q.limit || 25,
      offset: q.offset,
      select: q.select,
      relations: undefined,
      hidden: false,
    });
    console.log('TIMECHECK:SEARCH', moment().diff(now, 'ms'));

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    now = moment();
    const markets = result as Market[];
    for (const m of markets) {
      await this.marketSrv.extendMarket(m, q.select);
    }
    console.log('TIMECHECK:EXTEND', moment().diff(now, 'ms'));

    return ok().data(result).build();
  }

  /**
   * List permitted takers of a market
   * @param marketAddress The market ID
   * @param q The query object
   * @param [q.network] - The network name
   * @param [q.limit] - Limit the result
   * @param [q.offset] - The query offset
   */
  @Get('/:mid/permitted_takers')
  async listPermittedTraders(
    @Param('mid') marketAddress: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListPermittedTradersQueryDTO,
  ) {
    const res = await PermittedTrader.searchByNetworkMarketID(q.net, marketAddress, q.limit, q.offset);
    return ok().data(res).build();
  }

  /**
   * List permitted providers
   * @param marketAddress The market ID
   * @param q The query object
   * @param [q.network] The network name
   * @param [q.limit] Limit the result
   * @param [q.count] If set, only count is returned
   * @param [q.offset] The query offset
   */
  @Get('/:mid/permitted_providers')
  async listPermittedProviders(
    @Param('mid') marketAddress: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListPermittedProviderQueryDTO,
  ) {
    if (q.count) {
      const count = await LiquidityProvider.countByNetworkOrMarket(q.net, marketAddress);
      return ok().data({ count }).build<CountResponse>();
    }
    const res = await LiquidityProvider.search(q.net, marketAddress, q.limit || 25, q.offset || 0);
    return ok().data(res).build<LiquidityProvider[]>();
  }
}

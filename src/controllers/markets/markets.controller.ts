import { Controller, Get, Logger, Param, Query, ValidationPipe } from '@nestjs/common';
import { ok, throw400, throw404, throw500 } from '../../common/responses/responses';
import Market from '../../models/market';
import { isValidNetwork } from '../../network/common';
import { MarketService } from './market.service';
import PermittedTrader from '../../models/permitted_trader';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO, ListPermittedProviderQueryDTO, ListPermittedTradersQueryDTO, ListQueryDTO } from './query.dto';
import LiquidityProvider from '../../models/market_provider';
import { ConfigService } from '@nestjs/config';

@Controller('v1/markets')
export class MarketsController {
  private logger = new Logger(MarketsController.name);

  constructor(private marketSrv: MarketService, private cfgSrv: ConfigService) {}

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
   * @param [q.network] The network name
   * @param [q.creator] Filter the result by creator address
   * @param [q.address] Filter the result by market address
   * @param [q.base] The base asset address
   * @param [q.quote] The base asset address
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

    const result = await Market.search(
      q.net,
      q.creator,
      q.address,
      q.base,
      q.quote,
      q.query,
      q.price,
      q.liquidity,
      reqPutBadges,
      reqSwapBadges,
      q.offer,
      q.permSwap,
      q.permPut,
      q.instant,
      q.count,
      q.limit || 25,
      q.offset,
      q.select,
      undefined,
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const markets = result as Market[];
    for (const m of markets) {
      try {
        await this.marketSrv.extendMarket(m, q.select);
      } catch (error) {
        this.logger.error(error, null, 'list()');
        if (error.message.indexOf('invalid arrayify value') !== -1) throw404('market not found');
        else throw500('failed to get market');
      }
    }

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
    if (!isValidNetwork(q.net)) throw400('unknown network');
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

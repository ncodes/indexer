import { Controller, Get, Logger, Param, Query, ValidationPipe } from '@nestjs/common';
import { ok, throw400, throw404, throw500 } from '../../common/responses/responses';
import Market from '../../models/market';
import { isValidNetwork } from '../../network/common';
import { MarketsService } from './markets.service';
import InvitedMediator from '../../models/invited_mediators';
import PermittedTrader from '../../models/permitted_trader';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import {
  GetQueryDTO,
  ListInvitedMediatorsQueryDTO,
  ListPermittedProviderQueryDTO,
  ListPermittedTradersQueryDTO,
  ListQueryDTO,
} from './query.dto';
import MarketProvider from '../../models/market_provider';

@Controller('v1/markets')
export class MarketsController {
  private logger = new Logger(MarketsController.name);

  constructor(private marketSrv: MarketsService) {}

  /**
   * Get a market
   * @param marketId The market ID
   * @param q The query object
   *  - mid The market ID
   *  - [net] The network where it exists
   *  - [noMerge] Indicates prevent merging db object with contract object
   *  - [select] Select extend fields to return
   * @returns
   */
  @Get(':mid')
  async get(@Param('mid') marketId: string, @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const market = await Market.getMarket(q.net, marketId, q.select);
    if (!market) throw404('market not found');

    try {
      await this.marketSrv.extendMarket(market, q.noMerge, q.select);
      return ok().data(market).build();
    } catch (error) {
      this.logger.error(error, null, 'get()');
      if (error.message.indexOf('invalid arrayify value') !== -1) throw404('market not found');
      else throw500('failed to get market');
    }

    return ok().data(market).build();
  }

  /**
   * List markets
   * @param q The query object
   *  - [network] The network name
   *  - [creator] Filter the result by creator address (optional)
   *  - [base] The base asset address (optional)
   *  - [quote] The base asset address (optional)
   *  - [noPermSwap] Indicate to ignore market with permissioned swap enabled (optional)
   *  - [onlyPermMediate] Indicate to only return market that enabled permissioned mediation (optional)
   *  - [onlyInstant] Indicate to only return market where base and quote asset are on-chain (instant swap) (optional)
   *  - [minMediatorBond] Indicate to only return market with a specific minimum mediator bond (optional)
   *  - [minJoinedMediators] Indicate to only return market with a specific minimum number of joined mediators (optional)
   *  - [noMerge] Indicates to prevent merging contract object with DB object
   *  - [query] The query string
   *  - [count] Returns the count of markets only
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset
   *  - [select] Select fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const result = await Market.search(
      q.net,
      q.creator,
      q.base,
      q.quote,
      q.query,
      q.noPermSwap,
      q.onlyPermMediate,
      q.onlyInstant,
      q.minMediatorBond,
      q.minJoinedMediators,
      q.count,
      q.limit || 25,
      q.offset,
      q.select,
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const markets = result as Market[];
    for (const m of markets) {
      try {
        await this.marketSrv.extendMarket(m, q.noMerge, q.select);
      } catch (error) {
        this.logger.error(error, null, 'list()');
        if (error.message.indexOf('invalid arrayify value') !== -1) throw404('market not found');
        else throw500('failed to get market');
      }
    }

    return ok().data(markets).build();
  }

  /**
   * List invited mediators of a market
   * @param marketId The market ID
   * @param q The query object
   *  - [network] The network name
   *  - [mid] The market ID
   *  - [accepted] Indicate to return only accepted invitations
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset
   */
  @Get('/:mid/invited_mediators')
  async listInvitedMediators(
    @Param('mid') marketId: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListInvitedMediatorsQueryDTO,
  ) {
    const res = await InvitedMediator.searchByNetworkMarketID(
      q.net,
      q.marketId,
      q.accepted,
      q.limit,
      q.offset,
    );
    return ok().data(res).build();
  }

  /**
   * List permitted traders of a market
   * @param marketId The market ID
   * @param q The query object
   *  - [network] The network name
   *  - [limit] Limit the result (optional)
   *  - [offset] The query offset
   */
  @Get('/:mid/permitted_traders')
  async listPermittedTraders(
    @Param('mid') marketId: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListPermittedTradersQueryDTO,
  ) {
    if (!isValidNetwork(q.net)) throw400('unknown network');
    const res = await PermittedTrader.searchByNetworkMarketID(q.net, marketId, q.limit, q.offset);
    return ok().data(res).build();
  }

  /**
   * List permitted providers
   * @param marketId The market ID
   * @param q The query object
   *  - [network] The network name
   *  - [limit] Limit the result (optional)
   *  - [count] If set, only count is returned
   *  - [offset] The query offset
   */
  @Get('/:mid/permitted_providers')
  async listPermittedProviders(
    @Param('mid') marketId: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListPermittedProviderQueryDTO,
  ) {
    if (q.count) {
      const count = await MarketProvider.countByNetworkOrMarket(q.net, marketId);
      return ok().data({ count }).build<CountResponse>();
    }
    const res = await MarketProvider.search(q.net, marketId, q.limit || 25, q.offset || 0);
    return ok().data(res).build<MarketProvider[]>();
  }
}

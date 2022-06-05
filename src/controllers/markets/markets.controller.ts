import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ok,
  throw400,
  throw404,
  throw500,
} from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Market from '../../models/market';
import { isValidNetwork } from '../../network/common';
import { MarketsService } from './markets.service';

@Controller('v1/markets')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class MarketsController {
  private logger = new Logger(MarketsController.name);

  constructor(private marketSrv: MarketsService) {}

  /**
   * Get a market
   * @param network The network where it exists
   * @param mid The market ID
   * @param noMerge Indicates that market from DB should not be merged with
   * market from contract.
   * @returns
   */
  @Get(':net/:mid')
  async get(
    @Param('net') network,
    @Param('mid') mid: string,
    @Query('noMerge') noMerge: boolean,
  ) {
    if (!isValidNetwork(network)) throw400('unknown network');

    const market = await Market.getMarket(network, mid);
    if (!market) throw404('market not found');

    try {
      await this.marketSrv.extendMarket(market, noMerge);
      return ok().data(market).build();
    } catch (error) {
      this.logger.error(error, null, 'get()');
      if (error.message.indexOf('invalid arrayify value') !== -1)
        throw404('market not found');
      else throw500('failed to get market');
    }

    return ok().data(market).build();
  }

  /**
   * List markets
   * @param network The network name
   * @param creator Filter the result by creator address (optional)
   * @param noMerge Indicates that market from DB should not be merged with
   * market from contract.
   * @param queryData The query term
   * @returns
   */
  @Get(':net')
  async list(
    @Param('net') network,
    @Query('creator') creator,
    @Query('noMerge') noMerge: boolean,
    @Query('query') queryData: string,
  ) {
    if (!isValidNetwork(network)) throw400('unknown network');

    let query = Market.query();
    if (creator) query = query.where('creator', creator);
    if (queryData) query = Market.makeSearchQuery(query, queryData);

    // Get markets
    const markets = await query.execute();
    for (const m of markets) {
      try {
        await this.marketSrv.extendMarket(m, noMerge);
      } catch (error) {
        this.logger.error(error, null, 'list()');
        if (error.message.indexOf('invalid arrayify value') !== -1)
          throw404('market not found');
        else throw500('failed to get market');
      }
    }

    return ok().data(markets).build();
  }
}

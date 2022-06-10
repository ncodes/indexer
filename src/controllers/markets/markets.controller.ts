import { Controller, Get, Head, Logger, Param, Query, UseGuards } from '@nestjs/common';
import { ok, throw400, throw404, throw500 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Market from '../../models/market';
import { isValidNetwork } from '../../network/common';
import { MarketsService } from './markets.service';
import InvitedMediator from '../../models/invited_mediators';
import * as _ from 'lodash';
import PermittedTrader from '../../models/permitted_trader';

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
  @Get(':mid')
  async get(@Param('mid') mid: string, @Query('net') network, @Query('noMerge') noMerge: boolean) {
    if (!isValidNetwork(network)) throw400('unknown network');

    const market = await Market.getMarket(network, mid);
    if (!market) throw404('market not found');

    try {
      await this.marketSrv.extendMarket(market, noMerge);
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
   * @param network The network name
   * @param creator Filter the result by creator address (optional)
   * @param noMerge Indicates that market from DB should not be merged with
   * market from contract.
   * @param queryData The query term
   * @param count Returns the count of markets only
   * @returns
   */
  @Get()
  async list(
    @Query('net') network,
    @Query('creator') creator,
    @Query('noMerge') noMerge: boolean,
    @Query('query') queryData: string,
    @Query('count') count: boolean,
  ) {
    if (!isValidNetwork(network)) throw400('unknown network');

    let query = Market.query();
    if (creator) query = query.where('creator', creator);
    if (queryData) query = Market.makeSearchQuery(query, queryData);

    // Count mode
    if (count) {
      return ok()
        .data({
          count: await query
            .count('id')
            .first()
            .then((res: any) => {
              return res.count;
            }),
        })
        .build();
    }

    const markets = await query.execute();
    for (const m of markets) {
      try {
        await this.marketSrv.extendMarket(m, noMerge);
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
   * @param network The network name
   * @param mid The market ID
   * @param limit The number of result to return (optional)
   * @param accepted Indicate to return only accepted invitations
   * @param prevSerial The last seen serial number for pagination
   */
  @Get('/:mid/invited_mediators')
  async listInvitedMediators(
    @Query('net') network,
    @Param('mid') mid: string,
    @Query('limit') limit: string,
    @Query('accepted') accepted: string,
    @Query('prevSerial') prevSerial: string,
  ) {
    if (!isValidNetwork(network)) throw400('unknown network');
    const res = await InvitedMediator.searchByNetworkMarketID(
      network,
      mid,
      accepted === undefined ? undefined : accepted === 'true',
      parseInt(limit),
      parseInt(prevSerial),
    );
    return ok().data(res).build();
  }

  /**
   * List permitted traders of a market
   * @param network The network name
   * @param mid The market ID
   * @param limit The number of result to return (optional)
   * @param prevSerial The last seen serial number for pagination
   */
  @Get('/:mid/permitted_traders')
  async listPermittedTraders(
    @Query('net') network,
    @Param('mid') mid: string,
    @Query('limit') limit: string,
    @Query('prevSerial') prevSerial: string,
  ) {
    if (!isValidNetwork(network)) throw400('unknown network');
    const res = await PermittedTrader.searchByNetworkMarketID(
      network,
      mid,
      parseInt(limit),
      parseInt(prevSerial),
    );
    return ok().data(res).build();
  }
}

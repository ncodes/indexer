import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ok, throw404, throw500 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Market from '../../models/market';
import { isValidNetwork } from '../../network/common';
import NetworkService from '../../network/network.service';
import { MetadataService } from './../../services/metadata.service';
import { PriceService } from './../../services/price.service';
import { MarketsService } from './markets.service';

@Controller('v1/markets')
export class MarketsController {
  private logger = new Logger(MarketsController.name);

  constructor(
    private netSrv: NetworkService,
    private markerSrv: MarketsService,
    private priceSrv: PriceService,
    private metadataSrv: MetadataService,
  ) {}

  /**
   * Get a market
   * @param network The network where it exists
   * @param mid The market ID
   * @param noUnify Indicates that market from DB should not be merged with
   * market from contract.
   * @returns
   */
  @Get(':net/:mid')
  async get(
    @Param('net') network,
    @Param('mid') mid: string,
    @Query('noUnify') noUnify: boolean,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const market = await Market.find({ network, mid });
    if (!market) throw404('market not found');

    try {
      if (!noUnify) {
        const _m = await this.netSrv.getMarketCore(network).markets(market.mid);
        const marketFromContract = this.markerSrv.netMarketToJSON(_m);
        this.markerSrv.unifyMarkets(marketFromContract, market);
      }

      market.baseLogo = await this.metadataSrv.getLogo(
        market.base,
        market.baseAddress,
      );
      market.quoteLogo = await this.metadataSrv.getLogo(
        market.quote,
        market.quoteAddress,
      );

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
   * @param req The request object.
   * @param network The network name
   * @param creator Filter the result by creator address (optional)
   * @param noUnify Indicates that market from DB should not be merged with
   * market from contract.
   * @param mid Filter the result by market ID
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get(':net')
  async list(
    @Param('net') network,
    @Query('creator') creator,
    @Query('noUnify') noUnify: boolean,
    @Query('query') queryData: string,
  ) {
    let query = Market.query();
    if (creator) query = query.where('creator', creator);
    if (queryData) query = Market.makeSearchQuery(query, queryData);

    // Get markets
    const markets = await query.execute();
    for (const m of markets) {
      try {
        if (!noUnify) {
          const _m = await this.netSrv.getMarketCore(network).markets(m.mid);
          const marketFromContract = this.markerSrv.netMarketToJSON(_m);
          this.markerSrv.unifyMarkets(marketFromContract, m);
        }

        // Get logo URL
        m.baseLogo = await this.metadataSrv.getLogo(m.base, m.baseAddress);
        m.quoteLogo = await this.metadataSrv.getLogo(m.quote, m.quoteAddress);
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

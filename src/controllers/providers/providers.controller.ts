import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { isValidNetwork } from '../../network/common';
import { ok, throw404 } from '../../common/responses/responses';
import MarketProvider from '../../models/market_provider';

@Controller('v1/providers')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class ProvidersController {
  /**
   * List providers in a network or market
   * @param network The network name
   * @param mid The market ID (optional)
   * @param limit Limit the result (optional)
   * @param count If set, only count is returned
   * @param offset The query offset
   */
  @Get('')
  async list(
    @Query('net') network,
    @Query('mid') mid: string,
    @Query('limit') limit: string,
    @Query('count') count: boolean,
    @Query('offset') offset: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');

    if (count) {
      const count = await MarketProvider.countByNetworkOrMarket(network, mid);
      return ok().data({ count }).build<CountResponse>();
    }

    const res = await MarketProvider.search(
      network,
      mid,
      parseInt(limit || '25'),
      parseInt(offset) || 0,
    );

    return ok().data(res).build<MarketProvider[]>();
  }
}

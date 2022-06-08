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
   * Get count of providers in a network or market
   * @param network The network name
   * @param mid The market ID  (Optional)
   */
  @Get('count')
  async count(@Query('net') network, @Query('mid') mid: string) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const count = await MarketProvider.countByNetworkOrMarket(network, mid);
    return ok().data({ count }).build<CountResponse>();
  }

  /**
   * List providers in a network or market
   * @param network The network name
   * @param mid The market ID (optional)
   * @param limit Limit the result (optional)
   * @param prevSerial Set he next cursor point
   */
  @Get('')
  async list(
    @Query('net') network,
    @Query('mid') mid: string,
    @Query('limit') limit: string,
    @Query('prevSerial') prevSerial: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const res = await MarketProvider.search(
      network,
      mid,
      parseInt(limit) || 0,
      parseInt(prevSerial) || 0,
    );
    return ok().data(res).build<MarketProvider[]>();
  }
}

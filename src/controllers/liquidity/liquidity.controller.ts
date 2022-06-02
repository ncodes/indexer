import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ok, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Liquidity from '../../models/liquidity';
import { isValidNetwork } from '../../network/common';
import NetworkService from '../../network/network.service';
import { PriceService } from '../../services/price.service';
import { MarketsService } from '../markets/markets.service';

@Controller('v1/liquidities')
export class LiquidityController {
  constructor(
    private netSrv: NetworkService,
    private markerSrv: MarketsService,
    private priceSrv: PriceService,
  ) {}

  /**
   * Get liquidity belonging to an address in a market
   * @param network The network where it exists
   * @param provider The address if the liquidity owner
   * @returns
   */
  @Get(':net/:mid/:provider')
  async getByMarketAndProvider(
    @Param('net') network,
    @Param('mid') mid: string,
    @Param('provider') provider: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const liq = await Liquidity.getLiquidity(network, mid, provider);
    if (!liq) throw404('liquidity not found');
    return ok().data(liq).build();
  }

  /**
   * List liquidities associated with a market
   * @param network The network name.
   * @param mid The market ID
   * @param provider The provider address (optional)
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get(':net/:mid')
  async listByMarket(
    @Param('net') network,
    @Param('mid') mid: string,
    @Query('provider') provider: string,
  ) {
    const liquidities = await Liquidity.getMarketLiquidities(
      network,
      mid,
      provider,
    );
    return ok().data(liquidities).build();
  }

  /**
   * List liquidities in a network
   * @param network The network name.
   * @param provider The provider address (optional)
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get(':net')
  async listByProvider(
    @Param('net') network,
    @Query('provider') provider: string,
  ) {
    const liquidities = await Liquidity.getLiquidities(network, provider);
    return ok().data(liquidities).build();
  }
}

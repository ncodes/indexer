import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ok, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Liquidity from '../../models/liquidity';
import { isValidNetwork } from '../../network/common';
import { LiquidityService } from './liquidity.service';

@Controller('v1/liquidities')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class LiquidityController {
  constructor(private liqSrv: LiquidityService) {}

  /**
   * Get liquidity belonging to an address in a market
   * @param network The network where it exists
   * @param mid The market ID
   * @param provider The address if the liquidity owner
   * @param noMerge Indicates whether to merge DB liquidity info with
   * contract liquidity info
   * @returns
   */
  @Get(':mid/:provider')
  async get(
    @Param('mid') mid: string,
    @Param('provider') provider: string,
    @Query('net') network,
    @Query('noMerge') noMerge: boolean,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const liq = await Liquidity.getLiquidity(network, mid, provider);
    if (!liq) throw404('liquidity not found');
    await this.liqSrv.extendLiquidity(liq, noMerge);
    return ok().data(liq).build();
  }

  /**
   * List liquidities associated with a market
   * @param network The network name.
   * @param mid The market ID
   * @param provider The provider address (optional)
   * @param noMerge Indicates whether to merge DB liquidity info with
   * contract liquidity info
   * @param count Returns the count of matching result
   * @returns
   */
  @Get(':mid')
  async listInMarket(
    @Param('mid') mid: string,
    @Query('net') network,
    @Query('provider') provider: string,
    @Query('noMerge') noMerge: boolean,
    @Query('count') count: boolean,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    if (!count) {
      const liquidities = await Liquidity.getMarketLiquidities(network, mid, provider);
      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, noMerge);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({ count: await Liquidity.countMarketLiquidities(network, mid, provider) })
        .build();
    }
  }

  /**
   * List liquidities on a given network
   * @param network The network name.
   * @param provider The provider address (optional)
   * @param noMerge Indicates whether to merge DB liquidity info with
   * contract liquidity info
   * @param count Returns the count of matching result
   * @returns
   */
  @Get()
  async list(
    @Query('net') network,
    @Query('provider') provider: string,
    @Query('noMerge') noMerge: boolean,
    @Query('count') count: boolean,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    if (!count) {
      const liquidities = await Liquidity.getLiquidities(network, provider);
      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, noMerge);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({ count: await Liquidity.countLiquidities(network, provider) })
        .build();
    }
  }
}

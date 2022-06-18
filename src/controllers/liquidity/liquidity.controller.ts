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
   * List liquidities on a network
   * @param network The network name.
   * @param marketId The market ID (optional)
   * @param provider The provider address (optional)
   * @param noMerge Indicates whether to merge DB liquidity info with
   * contract liquidity info
   * @param count Returns the count of matching result
   * @param limit The number of result to return (optional)
   * @param offset The query offset (optional)
   * @param select Select extend fields to return
   * @returns
   */
  @Get()
  async list(
    @Query('net') network,
    @Query('mid') marketId: string,
    @Query('provider') provider: string,
    @Query('noMerge') noMerge: boolean,
    @Query('count') count: boolean,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('select') select: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    if (!count) {
      const selectedFields = select ? select.split(',') : [];
      const liquidities = await Liquidity.searchLiquidities(
        network,
        marketId,
        provider,
        parseInt(limit || '25'),
        parseInt(offset),
        selectedFields,
      );
      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, noMerge, selectedFields);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({ count: await Liquidity.countLiquidities(network, marketId, provider) })
        .build();
    }
  }
}

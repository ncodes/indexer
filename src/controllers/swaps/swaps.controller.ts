import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Swap from '../../models/swap';
import { ok, throw404 } from '../../common/responses/responses';
import Market from '../../models/market';
import { MarketsService } from '../markets/markets.service';
import { isValidNetwork } from '../../network/common';
import Liquidity from '../../models/liquidity';
import { LiquidityService } from '../liquidity/liquidity.service';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/swaps')
export class SwapsController {
  constructor(private marketSrv: MarketsService, private liqSrv: LiquidityService) {}

  /**
   * Get a swap
   * @param network The network name.
   * @param orderId The order ID
   * @param noMerge Prevent merge of contract liquidity with DB liquidity object
   * @param select Select fields to return
   */
  @Get(':orderId')
  async get(
    @Query('net') network,
    @Param('orderId') orderId: string,
    @Query('noMerge') noMerge: boolean,
    @Query('select') select: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const selectedFields = select ? select.split(',') : [];

    // Get swap
    const swap = await Swap.get(network, parseInt(orderId), selectedFields);
    if (!swap) throw404('swap not found');

    // Get market
    const market = await Market.getMarket(network, swap.marketId, selectedFields);
    if (!market) return throw404('market not found');
    await this.marketSrv.extendMarket(market, noMerge);
    swap.market = market;

    // Get liquidity
    const liquidity = await Liquidity.getLiquidity(
      network,
      swap.marketId,
      swap.provider,
      selectedFields,
    );
    if (!liquidity) return throw404('liquidity not found');
    await this.liqSrv.extendLiquidity(liquidity, noMerge, selectedFields, true);
    swap.liquidity = liquidity;

    return ok().data(swap).build<Swap>();
  }

  /**
   * List all swaps on a network
   * @param network The network name.
   * @param marketId The market ID (optional)
   * @param address The address involved as a provider or taker (optional)
   * @param noMerge Prevent merge of contract liquidity with DB liquidity object
   * @param limit The number of result to return (optional)
   * @param offset The query offset (optional)
   * @param select Select fields to return
   * @returns
   */
  @Get('')
  async list(
    @Query('net') network,
    @Query('mid') marketId: string,
    @Query('address') address: string,
    @Query('noMerge') noMerge: boolean,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('select') select: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const selectedFields = select ? select.split(',') : [];
    const swaps = await Swap.searchSwaps(
      network,
      marketId,
      address,
      parseInt(limit || '25'),
      parseInt(offset),
      selectedFields,
    );

    for (const swap of swaps) {
      const market = await Market.getMarket(network, swap.marketId, selectedFields);
      if (!market) return throw404('market not found');
      await this.marketSrv.extendMarket(market, noMerge, selectedFields);
      swap.market = market;

      const liquidity = await Liquidity.getLiquidity(
        network,
        swap.marketId,
        swap.provider,
        selectedFields,
      );
      if (!liquidity) return throw404('liquidity not found');
      await this.liqSrv.extendLiquidity(liquidity, noMerge, selectedFields, true);
      swap.liquidity = liquidity;
    }

    return ok().data(swaps).build();
  }
}

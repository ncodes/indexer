import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Swap from '../../models/swap';
import { ErrorTypes, ok, throw404 } from '../../common/responses/responses';
import Market from '../../models/market';
import { MarketsService } from '../markets/markets.service';
import Liquidity from '../../models/liquidity';
import { LiquidityService } from '../liquidity/liquidity.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO, ListQueryDTO } from './query.dto';
import SwapsService from './swaps.service';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/swaps')
export class SwapsController {
  constructor(
    private marketSrv: MarketsService,
    private liqSrv: LiquidityService,
    private swapSrv: SwapsService,
  ) {}

  /**
   * Get a swap
   * @param orderId The order ID
   * @param q The query object
   *  - [network] The network name.
   *  - [orderId] The order ID
   *  - [noMerge] Prevent merge of contract liquidity with DB liquidity object
   *  - [select] Select fields to return
   */
  @Get(':orderId')
  async get(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    // Get swap
    const swap = await Swap.get(q.net, orderId, q.select);
    if (!swap) throw404('swap not found');

    // Get market
    const market = await Market.getMarket(q.net, swap.marketId, q.select);
    if (!market) return throw404('market not found');
    await this.marketSrv.extendMarket(market, q.noMerge);
    swap.market = market;

    // Get liquidity
    const liquidity = await Liquidity.getLiquidity(q.net, swap.marketId, swap.provider, q.select);
    if (!liquidity) return throw404('liquidity not found');
    await this.liqSrv.extendLiquidity(liquidity, q.noMerge, q.select, true);
    swap.liquidity = liquidity;

    return ok().data(swap).build<Swap>();
  }

  /**
   * List all swaps on a network
   * @param q The query object
   *  - [network] The network name.
   *  - [marketId] The market ID (optional)
   *  - [address] The address involved as a provider or taker (optional)
   *  - [noMerge] Prevent merge of contract liquidity with DB liquidity object
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset (optional)
   *  - [select] Select fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const swaps = await Swap.searchSwaps(
      q.net,
      q.marketId,
      q.address,
      q.limit || 25,
      q.offset,
      q.select,
    );

    for (const swap of swaps) {
      const market = await Market.getMarket(q.net, swap.marketId, q.select);
      if (!market) return throw404('market not found');
      await this.marketSrv.extendMarket(market, q.noMerge, q.select);
      swap.market = market;

      const liquidity = await Liquidity.getLiquidity(q.net, swap.marketId, swap.provider, q.select);
      if (!liquidity) return throw404('liquidity not found');
      await this.liqSrv.extendLiquidity(liquidity, q.noMerge, q.select, true);
      swap.liquidity = liquidity;
    }

    return ok().data(swaps).build();
  }

  /**
   * List participants of a swap
   * @param id The swap ID
   * @param addAppealedDisputeDraftees If true, appealed disputes draftees
   * are added as participants.
   */
  @Get(':id/participants')
  async listParticipants(
    @Param('id') id: string,
    @Query('addAppealedDisputeDraftees') addAppealedDisputeDraftees: boolean,
  ) {
    const swap = await Swap.getById(id);
    if (!swap) throw404('swap not found', ErrorTypes.InvalidRequest, 'id');
    const participant = await this.swapSrv.getParticipants(swap, addAppealedDisputeDraftees);
    return ok().data(participant).build<Swap>();
  }
}

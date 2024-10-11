import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorTypes, ok, throw404 } from '../../common/responses/responses';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import Event, { EventActionClass } from '../../models/event';
import Swap from '../../models/swap';
import { LiquidityService } from '../liquidity/liquidity.service';
import { MarketService } from '../markets/market.service';
import { GetParticipantsDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import SwapService from './swap.service';

@Controller('v1/swaps')
export class SwapsController {
  constructor(private marketSrv: MarketService, private liqSrv: LiquidityService, private swapSrv: SwapService) {}

  // Get swap events
  @Get(':orderId/events')
  async events(@Param('orderId', ParseIntPipe) orderId: number, @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const events = await Event.search(
      EventActionClass.Swap,
      q.net,
      undefined,
      undefined,
      undefined,
      orderId,
      undefined,
      undefined,
      undefined,
      undefined,
      q.limit || 25,
      q.offset,
    );
    return ok().data(events).build<Event[]>();
  }

  /**
   * Get a swap
   * @param orderId The order ID
   * @param q The query object
   * @param q.net The network name.
   * @param [q.orderId] The order ID
   * @param [q.select] Select fields to return
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get(':orderId')
  async get(
    @Req() req: Request,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const relations =
      '[providerPaymentMethod,takerPaymentMethod,market,liquidity,disputes.[draftees,reveals,commits],payRouterRequest.[routePayments],appeal.[creator]]';
    const swap = await Swap.get(q.net, orderId, q.select, relations);
    if (!swap) throw404('swap not found');

    await this.swapSrv.extendSwap(swap, q.select);
    await this.marketSrv.extendMarket(swap.market, q.select);
    await this.liqSrv.extendLiquidity(swap.liquidity, q.select);

    // Only allow payment methods to be seen by the counterparties of the swap
    if (!req.user || (!Swap.isSwapCounterparty(swap, req.user.address) && !Swap.isRouter(swap, req.user.address))) {
      delete swap.providerPaymentMethod;
      delete swap.takerPaymentMethod;
      delete swap.appeal;
      (swap.payRouterRequest?.routes || []).forEach((route) => {
        delete route.paymentMethod;
      });
    }

    return ok().data(swap).build<Swap>();
  }

  /**
   * List all swaps on a network
   * @param q The query object
   * @param q.net The network name.
   * @param [q.marketAddress] The market ID (optional)
   * @param [q.base] The base token address or symbol (optional)
   * @param [q.quote] The quote token address or symbol (optional)
   * @param [q.address] The address involved as a provider or taker (optional)
   * @param [q.fromDate] The start date (optional)
   * @param [q.toDate] The end date (optional)
   * @param [q.status] The swap status (optional)
   * @param [q.type] The swap type (optional)
   * @param [q.limit] The number of result to return (optional)
   * @param [q.offset] The query offset (optional)
   * @param [q.select] Select fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const swaps = await Swap.search(
      q.net,
      q.marketAddress,
      q.base,
      q.quote,
      q.address,
      q.fromDate,
      q.toDate,
      q.status,
      q.type,
      q.limit || 25,
      q.offset,
      q.select,
      '[market,liquidity,disputes.[draftees,reveals,commits]]',
    );

    for (const swap of swaps) {
      await this.swapSrv.extendSwap(swap, q.select);
      await this.marketSrv.extendMarket(swap.market, q.select);
      await this.liqSrv.extendLiquidity(swap.liquidity, q.select);
    }

    return ok().data(swaps).build();
  }

  /**
   * List participants of a swap
   * @param orderId The order ID
   * @param q The query object
   * @param q.net The network name
   * @param [q.includeRedispute] Include redispute draftees
   */
  @Get(':orderId/participants')
  async listParticipants(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetParticipantsDTO,
  ) {
    const swap = await Swap.getByNetworkAndOrderId(q.net, orderId);
    if (!swap) throw404('swap not found', ErrorTypes.InvalidRequest, 'id');
    const participant = await this.swapSrv.getParticipants(swap, q.includeRedispute);
    return ok().data(participant).build<string[]>();
  }
}

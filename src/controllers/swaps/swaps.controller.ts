import {
  All,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Query,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as moment from 'moment';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorTypes, ok, throw404 } from '../../common/responses/responses';
import Event, { EventActionClass } from '../../models/event';
import Swap, { SwapType } from '../../models/swap';
import { LiquidityService } from '../liquidity/liquidity.service';
import { MarketService } from '../markets/market.service';
import { GetParticipantsDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import SwapService from './swap.service';

@Controller('v1/swaps')
export class SwapsController {
  private logger = new Logger(SwapsController.name);

  constructor(
    private marketSrv: MarketService,
    private liqSrv: LiquidityService,
    private swapSrv: SwapService,
    private cfgSrv: ConfigService,
  ) {}

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
  @Get(':orderId')
  async get(@Param('orderId', ParseIntPipe) orderId: number, @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const swap = await Swap.get(q.net, orderId, q.select, '[market,liquidity,disputes.[draftees,reveals,commits]]');
    if (!swap) throw404('swap not found');
    await this.swapSrv.extendSwap(swap, q.select);
    await this.marketSrv.extendMarket(swap.market, q.select);
    await this.liqSrv.extendLiquidity(swap.liquidity, q.select);
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
    const swaps = await Swap.search({
      network: q.net,
      marketAddress: q.marketAddress,
      base: q.base,
      quote: q.quote,
      providerOrTaker: q.address,
      fromDate: q.fromDate,
      toDate: q.toDate,
      status: q.status,
      type: q.type,
      limit: q.limit || 25,
      offset: q.offset,
      select: q.select,
      relations: '[market,liquidity,disputes.[draftees,reveals,commits]]',
    });

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

  /**
   * Verify QuestN swap
   * @param address The address to verify
   * @param res The response object
   * @returns
   */
  @All('questn/verify')
  async verifyQuestNSwap(@Query('address') address: string, @Res() res: Response) {
    let resp: any = {};
    try {
      const startTime = moment.unix(this.cfgSrv.get('app.questn.swapStartTime'));
      const swaps = await Swap.search({
        network: 'localhost',
        marketAddress: this.cfgSrv.get('app.swapMarket'),
        provider: this.cfgSrv.get('app.swapProvider'),
        fromDate: startTime.toISOString(),
        type: SwapType.Instant,
        limit: 1,
      });

      resp = {
        data: {
          result: swaps.length > 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to verify QuestN swap', error);
      resp = {
        data: {
          result: false,
        },
        error: {
          code: 500,
          message: 'Internal server error',
        },
      };
    }

    return res.status(HttpStatus.OK).json(resp);
  }
}

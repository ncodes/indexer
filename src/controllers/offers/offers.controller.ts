import { Body, Controller, Get, Logger, Param, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { OfferService } from './offer.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ReadQueryDTO, GetParamDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import Offer from '../../models/offer';
import { ok, throw404 } from '../../common/responses/responses';
import Event from '../../models/event';
import { MarketService } from '../markets/market.service';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { Request } from 'express';

@Controller('v1/offers')
export class OfferController {
  private logger = new Logger(OfferController.name);

  constructor(private offerSrv: OfferService, private mktSrv: MarketService) {}

  /**
   * Get offer events by offer ID
   * @param params The url parameters
   * @param params.offerId The offer ID
   * @param q The query object
   * @param q.net The network name
   */
  @Get(':offerId/events')
  async events(
    @Param(new ValidationPipe(ValPipeOpt)) params: GetParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const events = await Event.search(
      q.net,
      undefined,
      undefined,
      undefined,
      undefined,
      params.offerId,
      undefined,
      undefined,
      undefined,
      q.limit || 25,
      q.offset,
    );
    return ok().data(events).build();
  }

  /**
   * List offers
   * @param q The query object
   * @param [q.network] The network name
   * @param [q.creator] Filter the result by creator address
   * @param [q.marketAddress] Filter the result by market address
   * @param [q.provider] Filter the result by liquidity provider address
   * @param [q.lid] Filter the result by liquidity provider ID
   * @param [q.status] The swap status (optional)
   * @param [q.fromDate] The start date (optional)
   * @param [q.toDate] The end date (optional)
   * @param [q.count] Returns only the count of matching result
   * @param [q.select] Select fields to return
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const result = await Offer.search(
      q.net,
      q.creator,
      q.provider,
      q.creatorOrProvider,
      q.marketAddress,
      q.lid,
      q.status,
      q.fromDate,
      q.toDate,
      undefined,
      undefined,
      q.count,
      q.limit,
      q.offset,
      q.select,
      '[market,liquidity,swap]',
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const offers = result as Offer[];
    for (const offer of offers) {
      await this.offerSrv.extendOffer(offer, q.select);
      if (offer.market) await this.mktSrv.extendMarket(offer.market, ['baseLogo', 'quoteLogo']);
    }

    return ok().data(offers).build();
  }

  /**
   * Count unread offers
   * @param req The request object
   * @param q The query object
   * @param q.net The network name
   * @param [q.marketAddress] The market address
   * @param [q.provider] The liquidity provider address
   * @param [q.lid] The liquidity ID
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/count-unread')
  async countUnread(@Req() req: Request, @Query(new ValidationPipe(ValPipeOpt)) q: ReadQueryDTO) {
    const nUnreadAsProvider = await Offer.search(
      q.net,
      undefined,
      req.user.address,
      undefined,
      q.marketAddress,
      q.lid,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      true,
    );

    const nUnreadAsOfferer = await Offer.search(
      q.net,
      req.user.address,
      q.provider,
      undefined,
      q.marketAddress,
      q.lid,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      true,
    );

    return ok()
      .data({
        asProvider: parseInt(nUnreadAsProvider as string),
        asOfferer: parseInt(nUnreadAsOfferer as string),
      })
      .build();
  }

  /**
   * Mark offers as read
   * @param req The request object
   * @param q The query object
   * @param q.net The network name
   * @param [q.marketAddress] The market address
   * @param [q.provider] The liquidity provider address
   * @param [q.lid] The liquidity ID
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/mark-read')
  async markAsRead(@Req() req: Request, @Query(new ValidationPipe(ValPipeOpt)) q: ReadQueryDTO) {
    await Offer.updateReadState(q.net, undefined, req.user.address, q.marketAddress, q.lid, true, undefined);
    await Offer.updateReadState(q.net, req.user.address, q.provider, q.marketAddress, q.lid, undefined, true);
    return ok().data({ success: true }).build();
  }

  /**
   * Get offer by ID
   * @param params The url parameters
   * @param params.offerId The offer ID
   * @param q The query object
   * @param q.net The network name
   * @param [q.select] Select fields to return
   */
  @Get(':offerId')
  async get(
    @Param(new ValidationPipe(ValPipeOpt)) params: GetParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const offer = await Offer.getByNetworkAndOfferId(q.net, params.offerId, undefined, '[market,liquidity]');
    if (!offer) throw404('market not found');
    await this.offerSrv.extendOffer(offer, q.select);
    return ok().data(offer).build();
  }
}

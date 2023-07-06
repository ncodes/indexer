import { Controller, Get, Logger, Param, Query, ValidationPipe } from '@nestjs/common';
import { OfferService } from './offer.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetParamDTO, GetQueryDTO, ListQueryDTO } from './query.dto';
import Offer from '../../models/offers';
import { ok, throw404 } from '../../common/responses/responses';

@Controller('v1/offers')
export class OfferController {
  private logger = new Logger(OfferController.name);

  constructor(private offerSrv: OfferService) {}

  /**
   * Get offer by ID
   * @param params The url parameters
   * @param q The query object
   * @param q.net The network name
   * @param [q.select] Select fields to return
   */
  @Get(':offerId')
  async get(
    @Param(new ValidationPipe(ValPipeOpt)) params: GetParamDTO,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    const offer = await Offer.getByNetworkAndOfferId(q.net, params.offerId);
    if (!offer) throw404('market not found');
    await this.offerSrv.extendOffer(offer, q.select);
    return ok().data(offer).build();
  }

  /**
   * List offers
   * @param q The query object
   * @param [q.network] The network name
   * @param [q.creator] Filter the result by creator address
   * @param [q.marketAddress] Filter the result by market address
   * @param [q.provider] Filter the result by liquidity provider address
   * @param [q.lid] Filter the result by liquidity provider ID
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
      q.marketAddress,
      q.provider,
      q.lid,
      q.count,
      q.limit,
      q.offset,
      q.select,
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const offers = result as Offer[];
    for (const offer of offers) {
      await this.offerSrv.extendOffer(offer, q.select).catch((e) => {
        this.logger.error(e, null, 'list()');
      });
    }

    return ok().data(offers).build();
  }
}

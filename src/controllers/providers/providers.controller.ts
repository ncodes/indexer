import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { ok } from '../../common/responses/responses';
import MarketProvider from '../../models/market_provider';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';

@Controller('v1/providers')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class ProvidersController {
  /**
   * List providers
   * @param q The query object
   *  - [network] The network name
   *  - [mid] The market ID (optional)
   *  - [limit] Limit the result (optional)
   *  - [count] If set, only count is returned
   *  - [offset] The query offset
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (q.count) {
      const count = await MarketProvider.countByNetworkOrMarket(q.net, q.marketId);
      return ok().data({ count }).build<CountResponse>();
    }
    const res = await MarketProvider.search(q.net, q.marketId, q.limit || 25, q.offset || 0);
    return ok().data(res).build<MarketProvider[]>();
  }
}

import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import Event from '../../models/event';
import { ok } from '../../common/responses/responses';
import { GetQueryDTO } from './query.dto';

@Controller('v1/timelines')
export class TimelinesController {
  /**
   * Get timeline
   * @param q The query parameter
   * @param q.net The network name
   * @param q.markets Filter by a list of market addresses
   * @param q.wallets Filter by a list of wallet addresses
   * @param q.liquidities Filter by a list of liquidities
   * @param q.limit The query limit
   * @param q.lastSerial The last serial number of the previous query
   */
  @Get()
  async get(@Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const events = await Event.search(
      q.net,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      q.markets,
      q.wallets,
      q.liquidities,
      q.limit,
      undefined,
      q.lastSerial,
    );

    return ok().data(events).build();
  }
}

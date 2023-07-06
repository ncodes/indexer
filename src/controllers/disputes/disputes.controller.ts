import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ok } from '../../common/responses/responses';
import Dispute from '../../models/dispute';
import { ListQueryDTO } from './query.dto';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';

@Controller('v1/disputes')
export class DisputesController {
  /**
   * List disputes
   * @param q The query object
   * @param q.network The network name
   * @param [q.marketAddress] Filter by the  market ID
   * @param [q.creator] Filter by the dispute creator
   * @param [q.defendant] Filter by the dispute defendant
   * @param [q.orderId] Filter by the ID of the order the ticket was drafted to
   * @param [q.disputeId] Filter by the dispute the ticket was drafted to
   * @param [q.redispute] Filter by redispute status
   * @param [q.executed] Filter by execution status
   * @param [q.released] Filter by release status
   * @param [q.abandoned] Filter by abandon status
   * @param [q.orderReleased] Filter by order release status
   * @param [q.count] Return count information only
   * @param [q.limit] Limit the number of records returned
   * @param [q.offset] Set query offset (for pagination)
   * @param [q.select] Select specific fields from the query
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const result = await Dispute.searchDisputes(
      q.net,
      q.marketAddress,
      q.creator,
      q.defendant,
      q.orderId,
      q.disputeId,
      q.redispute,
      q.executed,
      q.released,
      q.abandoned,
      q.orderReleased,
      q.count,
      Math.min(q.limit || 25, 100),
      q.offset,
      q.select,
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    return ok().data(result).build();
  }
}

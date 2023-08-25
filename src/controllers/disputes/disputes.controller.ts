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
   * @param [q.participant] Filter by the dispute participation as creator, defendant or draftee
   * @param [q.creator] Filter by the dispute creator
   * @param [q.defendant] Filter by the dispute defendant
   * @param [q.orderId] Filter by the ID of the order the ticket was drafted to
   * @param [q.disputeId] Filter by the dispute the ticket was drafted to
   * @param [q.status] Filter by the dispute status
   * @param [q.fromDate] Filter by the date the dispute was created after
   * @param [q.toDate] Filter by the date the dispute was created before
   * @param [q.count] Return count information only
   * @param [q.limit] Limit the number of records returned
   * @param [q.offset] Set query offset (for pagination)
   * @param [q.select] Select specific fields from the query
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const result = await Dispute.search(
      q.net,
      q.marketAddress,
      q.participant,
      q.creator,
      q.defendant,
      q.orderId,
      q.disputeId,
      q.status,
      q.fromDate,
      q.toDate,
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

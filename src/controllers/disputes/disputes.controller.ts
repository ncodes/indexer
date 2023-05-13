import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ok } from '../../common/responses/responses';
import Dispute from '../../models/dispute';
import { ListQueryDTO } from './query.dto';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';

@Controller('v1/disputes')
export class DisputesController {
  /**
   * List disputes
   * @param q The query object
   *  - [network] The network name
   *  - [marketAddress] Filter by the  market ID
   *  - [creator] Filter by the dispute creator
   *  - [defendant] Filter by the dispute defendant
   *  - [orderId] Filter by the ID of the order the ticket was drafted to
   *  - [disputeId] Filter by the dispute the ticket was drafted to
   *  - [appeal] Filter by appeal status
   *  - [executed] Filter by execution status
   *  - [released] Filter by release status
   *  - [abandoned] Filter by abandon status
   *  - [orderReleased] Filter by order release status
   *  - [count] Return count information only
   *  - [limit] Limit the number of records returned
   *  - [offset] Set query offset (for pagination)
   *  - [select] Select specific fields from the query
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      return ok()
        .data(
          await Dispute.searchDisputes(
            q.net,
            q.marketAddress,
            q.creator,
            q.defendant,
            q.orderId,
            q.disputeId,
            q.appeal,
            q.executed,
            q.released && q.released,
            q.abandoned,
            q.orderReleased,
            q.limit || 25,
            q.offset,
            q.select,
          ),
        )
        .build();
    } else {
      return ok()
        .data({
          count: await Dispute.countDisputes(
            q.net,
            q.marketAddress,
            q.creator,
            q.defendant,
            q.orderId,
            q.disputeId,
            q.appeal,
            q.executed,
            q.released,
            q.abandoned,
            q.orderReleased,
          ),
        })
        .build();
    }
  }
}

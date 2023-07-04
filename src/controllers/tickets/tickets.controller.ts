import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ok, throw404 } from '../../common/responses/responses';
import Ticket from '../../models/ticket';
import { TicketsService } from './tickets.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO, ListQueryDTO } from './query.dto';

@Controller('v1/tickets')
export class TicketsController {
  constructor(private tickSrv: TicketsService) {}

  /**
   * Get a ticket
   * @param q The query object
   * @param q.net The network name.
   * @param [q.owner] The owner of the ticket
   * @param [q.index] The ticket ID
   * @param [q.select] Select what fields to return
   */
  @Get(':owner/:index')
  async get(@Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(q.net, q.owner, q.index, q.select);
    if (!ticket) throw404('ticket not found');
    await this.tickSrv.extendTicket(ticket, q.select);
    return ok().data(ticket).build();
  }

  /**
   * List tickets
   * @param q The query object
   * @param q.net The network name
   * @param [q.marketAddress] Filter by the market the ticket joined
   * @param [q.disputeId] Filter by the dispute the ticket was drafted to
   * @param [q.orderId] Filter by the order the ticket's current dispute belongs to
   * @param [q.owner] Filter by owner address
   * @param [q.delegate] Filter by delegate address
   * @param [q.joined] Filter by joined status of the ticket
   * @param [q.matured] Filter by maturity status
   * @param [q.drafted] Filter by drafted status of the ticket
   * @param [q.expired] Filter by expired status
   * @param [q.cancelled] Filter by cancelled status
   * @param [q.count] Return count information only
   * @param [q.slashed] Filter by slashed status
   * @param [q.noMerge] Prevent merge of contract ticket with DB ticket object
   * @param [q.limit] Limit the number of records returned
   * @param [q.offset] Set query offset (for pagination)
   * @param [q.select] Select specific fields from the query
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      const result = await Ticket.searchTickets(
        q.net,
        q.poolId,
        q.owner,
        q.orderId,
        q.disputeId,
        q.joined,
        q.matured,
        q.drafted,
        q.expired,
        q.cancelled,
        q.slashed,
        Math.min(q.limit || 25, 100),
        q.offset,
        q.select,
      );
      for (const ticket of result) {
        await this.tickSrv.extendTicket(ticket, q.select);
      }
      return ok().data(result).build();
    } else {
      return ok()
        .data({
          count: await Ticket.countTickets(
            q.net,
            q.poolId,
            q.owner,
            q.orderId,
            q.disputeId,
            q.joined,
            q.matured,
            q.drafted,
            q.expired,
            q.cancelled,
            q.slashed,
          ),
        })
        .build();
    }
  }
}

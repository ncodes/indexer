import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { ok, throw404 } from '../../common/responses/responses';
import Ticket from '../../models/ticket';
import { TicketsService } from './tickets.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO, ListQueryDTO } from './query.dto';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/tickets')
export class TicketsController {
  constructor(private tickSrv: TicketsService) {}

  /**
   * Get a ticket
   * @param q The query object
   *  - @param [network] The network name.
   *  - @param [owner] The owner of the ticket
   *  - @param [index] The ticket ID
   *  - @param [noMerge] Prevent merge of contract ticket with DB ticket object
   *  - @param [select] Select what fields to return
   */
  @Get(':owner/:index')
  async get(@Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    const ticket = await Ticket.getByNetworkOwnerAndIndex(q.net, q.owner, q.index, q.select);
    if (!ticket) throw404('ticket not found');
    await this.tickSrv.extendTicket(ticket, q.noMerge, q.select);
    return ok().data(ticket).build();
  }

  /**
   * List tickets
   * @param q The query object
   *  - [marketId] Filter by the market the ticket joined
   *  - [disputeId] Filter by the dispute the ticket was drafted to
   *  - [orderId] Filter by the order the ticket's current dispute belongs to
   *  - [owner] Filter by owner address
   *  - [delegate] Filter by delegate address
   *  - [joined] Filter by joined status of the ticket
   *  - [matured] Filter by maturity status
   *  - [drafted] Filter by drafted status of the ticket
   *  - [expired] Filter by expired status
   *  - [cancelled] Filter by cancelled status
   *  - [count] Return count information only
   *  - [slashed] Filter by slashed status
   *  - [noMerge] Prevent merge of contract ticket with DB ticket object
   *  - [limit] Limit the number of records returned
   *  - [offset] Set query offset (for pagination)
   *  - [select] Select specific fields from the query
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      const result = await Ticket.searchTickets(
        q.net,
        q.marketId,
        q.owner,
        q.delegate,
        q.orderId,
        q.disputeId,
        q.joined,
        q.matured,
        q.drafted,
        q.expired,
        q.cancelled,
        q.slashed,
        q.limit || 25,
        q.offset,
        q.select,
      );
      for (const ticket of result) {
        await this.tickSrv.extendTicket(ticket, q.noMerge, q.select);
      }
      return ok().data(result).build();
    } else {
      return ok()
        .data({
          count: await Ticket.countTickets(
            q.net,
            q.marketId,
            q.owner,
            q.delegate,
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

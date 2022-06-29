import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { isValidNetwork } from '../../network/common';
import { ok, throw404 } from '../../common/responses/responses';
import Ticket from '../../models/ticket';
import { TicketsService } from './tickets.service';
import * as s from 'underscore.string';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/tickets')
export class TicketsController {
  constructor(private tickSrv: TicketsService) {}

  /**
   * Get a ticket
   * @param network The network name.
   * @param owner The owner of the ticket
   * @param index The ticket ID
   * @param noMerge Prevent merge of contract ticket with DB ticket object
   * @param select Select what fields to return
   */
  @Get(':owner/:index')
  async get(
    @Query('net') network,
    @Param('owner') owner,
    @Param('index') index,
    @Query('noMerge') noMerge: boolean,
    @Query('select') select: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const selectedFields = select ? select.split(',') : [];
    const ticket = await Ticket.getByNetworkOwnerAndIndex(
      network,
      owner,
      parseInt(index),
      selectedFields,
    );
    if (!ticket) throw404('ticket not found');
    await this.tickSrv.extendTicket(ticket, noMerge, selectedFields);
    return ok().data(ticket).build();
  }

  /**
   * List tickets
   * @param network The network name
   * @param marketId The market ID
   * @param owner Filter by ticket owner address
   * @param orderId Filter by the ID of the order the ticket was drafted to.
   * @param disputeId Filter by the dispute the ticket was drafted to
   * @param joined Filter by joined status of the ticket
   * @param matured Filter by maturity status
   * @param drafted Filter by drafted status of the ticket
   * @param expired Filter by expired status
   * @param cancelled Filter by cancelled status
   * @param count Return count information only
   * @param slashed Filter by slashed status
   * @param noMerge Prevent merge of contract ticket with DB ticket object
   * @param limit Limit the number of records returned
   * @param offset Set query offset (for pagination)
   * @param select Select specific fields from the query
   */
  @Get('')
  async list(
    @Query('net') network,
    @Query('mid') marketId: string,
    @Query('owner') owner: string,
    @Query('orderId') orderId: string,
    @Query('disputeId') disputeId: string,
    @Query('joined') joined: string,
    @Query('matured') matured: string,
    @Query('drafted') drafted: string,
    @Query('expired') expired: string,
    @Query('cancelled') cancelled: string,
    @Query('count') count: boolean,
    @Query('slashed') slashed: string,
    @Query('noMerge') noMerge: boolean,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('select') select: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    if (!count) {
      const selectedFields = select ? select.split(',') : [];
      const liquidities = await Ticket.searchTickets(
        network,
        marketId,
        owner,
        parseInt(orderId),
        parseInt(disputeId),
        joined && s.toBoolean(joined),
        matured && s.toBoolean(matured),
        drafted && s.toBoolean(drafted),
        expired && s.toBoolean(expired),
        cancelled && s.toBoolean(cancelled),
        slashed && s.toBoolean(slashed),
        parseInt(limit || '25'),
        parseInt(offset),
        selectedFields,
      );
      for (const ticket of liquidities) {
        await this.tickSrv.extendTicket(ticket, noMerge, selectedFields);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({
          count: await Ticket.countTickets(
            network,
            owner,
            marketId,
            parseInt(orderId),
            parseInt(disputeId),
            joined && s.toBoolean(joined),
            matured && s.toBoolean(matured),
            drafted && s.toBoolean(drafted),
            expired && s.toBoolean(expired),
            cancelled && s.toBoolean(cancelled),
            slashed && s.toBoolean(slashed),
          ),
        })
        .build();
    }
  }
}

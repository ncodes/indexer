import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw404 } from '../../common/responses/responses';
import Ticket from '../../models/ticket';
import { toNumber } from '../../network/common';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { toDec } from './../../common/common';
import { GetQueryDTO, ListQueryDTO, StatsQueryDTO } from './query.dto';
import { TicketsService } from './tickets.service';

interface StatsResponse {
  totalBonds: string;
  totalBondsUsd: number;
  price: string;
  priceUsd: number;
  ticketSupply: number;
  ticketAvailable: number;
  owner?: {
    totalBonds?: string;
    totalBondsUsd?: number;
    total?: string;
  };
}

@Controller('v1/tickets')
export class TicketsController {
  constructor(
    private tickSrv: TicketsService,
    private netSrv: NetworkService,
    private metadataSrv: MetadataService,
    private cfgSrv: ConfigService,
  ) {}

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
   * @param [q.poolId] Filter by the pool the ticket was drafted to
   * @param [q.owner] Filter by owner address
   * @param [q.orderId] Filter by the order the ticket's current dispute belongs to
   * @param [q.disputeId] Filter by the dispute the ticket was drafted to
   * @param [q.status] Filter by ticket status
   * @param [q.count] Return count information only
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
        q.status,
        Math.min(q.limit || 25, 100),
        q.offset,
        q.select,
        '[drafts]',
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

  /**
   * Get ticket stats
   * @param q The query object
   * @param q.net The network name
   * @param [q.owner] Filter by owner address
   */
  @Get('stats')
  async stats(@Query(new ValidationPipe(ValPipeOpt)) q: StatsQueryDTO) {
    const totalBonds = await Ticket.getTotalBonds(q.net, undefined, undefined);

    const mediatorMgr = await this.netSrv.getContracts(q.net).mediatorMgr;
    const price = await mediatorMgr.getTicketPrice();
    const ticketSupply = await mediatorMgr.ticketSupply();
    const ticketSold = await mediatorMgr.ticketSold();

    const p2pAddress = this.netSrv.getContracts(q.net).nativeToken.target as string;

    const ownerInfo: { totalBonds?: string; totalBondsUsd?: number; total?: string } = {};
    if (q.owner) {
      ownerInfo.totalBonds = await Ticket.getTotalBonds(q.net, undefined, q.owner);
      ownerInfo.total = await Ticket.countTickets(q.net, undefined, q.owner);
      ownerInfo.totalBondsUsd = await this.metadataSrv.tryToUsd(q.net, ownerInfo.totalBonds.toString(), p2pAddress);
    }

    const totalBondsUsd = await this.metadataSrv.tryToUsd(q.net, totalBonds?.toString(), p2pAddress);
    const priceUsd = await this.metadataSrv.tryToUsd(q.net, price?.toString(), p2pAddress);

    const resp: StatsResponse = {
      totalBonds,
      totalBondsUsd,
      price: price?.toString(),
      priceUsd,
      ticketSupply: toNumber(ticketSupply || '0'),
      ticketAvailable: toDec(ticketSupply).sub(ticketSold.toString()).toNumber(),
    };

    if (q.owner) {
      resp.owner = ownerInfo;
    }

    return ok().data(resp).build();
  }
}

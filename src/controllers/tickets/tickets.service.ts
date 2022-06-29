import { Injectable } from '@nestjs/common';
import Market from '../../models/market';
import Ticket from '../../models/ticket';
import { MarketsService } from '../markets/markets.service';
import * as moment from 'moment';

@Injectable()
export class TicketsService {
  constructor(private marketSrv: MarketsService) {}

  /**
   * Extend a DB-sourced ticket with other liquidity information
   * @param ticket
   * @param noMerge Indicate whether to fetch and merge in contract-sourced objects info.
   * @param select Select the extended field to be returned
   * @param noMarket No fetching of market info
   * @returns
   */
  async extendTicket(ticket: Ticket, noMerge = false, select = [], noMarket = false) {
    try {
      const { network, marketId } = ticket;
      const now = moment();

      if (select.includes(`matured`) || !select.length)
        if (now.isAfter(ticket.matureAt)) ticket.matured = true;

      if (select.includes(`expired`) || !select.length) {
        if (ticket.joinBy && now.isAfter(ticket.joinBy) && !marketId) ticket.expired = true;
        if (ticket.drained) ticket.expired = true;
      }

      if (select.includes(`cancelling`) || !select.length)
        if (ticket.cancelAt && now.isBefore(ticket.cancelAt)) ticket.cancelling = true;

      if (select.includes(`cancelled`) || !select.length)
        if (ticket.cancelAt && now.isAfter(ticket.cancelAt)) ticket.cancelled = true;

      if (select.includes(`canLeave`) || !select.length)
        if (ticket.leaveAt && now.isAfter(ticket.leaveAt)) ticket.canLeave = true;

      if (!noMarket && ticket.marketId) {
        const market = await Market.getMarket(network, marketId, select);
        if (!market) return Promise.reject(new Error('market not found'));
        await this.marketSrv.extendMarket(market, noMerge, select);
        ticket.market = market;
      }

      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

import { Injectable } from '@nestjs/common';
import Ticket from '../../models/ticket';
import * as moment from 'moment';

@Injectable()
export class TicketsService {
  /**
   * Extend a DB-sourced ticket with other liquidity information
   * @param ticket
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendTicket(ticket: Ticket, select = []) {
    try {
      const { joined, joinBy, drained, cancelAt } = ticket;
      const now = moment();

      if (select.includes(`matured`) || !select.length) ticket.matured = now.isAfter(ticket.matureAt);

      if (select.includes(`expired`) || !select.length) {
        ticket.expired = (!joined && joinBy && now.isAfter(joinBy)) || drained;
      }

      if (select.includes(`cancelling`) || !select.length) {
        ticket.cancelling = cancelAt && now.isBefore(cancelAt);
      }

      if (select.includes(`cancelled`) || !select.length) {
        ticket.cancelled = cancelAt && now.isAfter(cancelAt);
      }

      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

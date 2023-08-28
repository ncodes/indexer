import { Injectable } from '@nestjs/common';
import Ticket from '../../models/ticket';
import * as moment from 'moment';
import * as _ from 'lodash';

@Injectable()
export class TicketsService {
  /**
   * Extend a DB-sourced ticket with other liquidity information
   * @param ticket
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendTicket(ticket: Ticket, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));

    try {
      const { joined, joinBy, drained, cancelAt } = ticket;
      const now = moment();

      if (select.includes(`matured`) || !select.length) ticket.matured = now.isAfter(ticket.matureAt) && !ticket.joined;

      if (select.includes(`expired`) || !select.length) {
        ticket.expired = !joined && joinBy && now.isAfter(joinBy);
      }

      if (select.includes(`cancelling`) || !select.length) {
        ticket.cancelling = !joined && cancelAt && now.isBefore(cancelAt);
      }

      if (select.includes(`cancelled`) || !select.length) {
        ticket.cancelled = !joined && cancelAt && now.isAfter(cancelAt);
      }

      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

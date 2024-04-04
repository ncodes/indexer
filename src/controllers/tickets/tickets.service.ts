import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import * as moment from 'moment';
import { getContractsAddress } from '../../common/common';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import { isZero } from '../../network/common';
import { MetadataService } from '../../services/metadata/metadata.service';

@Injectable()
export class TicketsService {
  constructor(private metadataSrv: MetadataService, private cfgSrv: ConfigService) {}

  /**
   * Extend a DB-sourced ticket with other liquidity information
   * @param ticket
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendTicket(ticket: Ticket, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));

    try {
      const { joined, joinBy, cancelAt } = ticket;
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

      if (select.includes(`slashedAmt`) || !select.length) {
        ticket.slashedAmt = await TicketSlash.getSumOfSlashedAmount(ticket.network, ticket.owner, ticket.index);
      }

      if ((select.includes(`slashedAmtUsd`) && !isZero(ticket.slashedAmt)) || !select.length) {
        const p2pTokenAddr = getContractsAddress(ticket.network, 'token');
        ticket.slashedAmtUsd = await this.metadataSrv.tryToUsd(ticket.network, ticket.slashedAmt, p2pTokenAddr);
      }

      if ((select.includes(`bondUsd`) && !isZero(ticket.bond)) || !select.length) {
        const p2pTokenAddr = getContractsAddress(ticket.network, 'token');
        ticket.bondUsd = await this.metadataSrv.tryToUsd(ticket.network, ticket.bond, p2pTokenAddr);
      }

      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

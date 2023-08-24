import { Injectable } from '@nestjs/common';
import Offer from '../../models/offer';
import * as _ from 'lodash';
import { isZero } from '../../network/common';
import { MetadataService } from '../../services/metadata/metadata.service';

@Injectable()
export class OfferService {
  constructor(private metadataSrv: MetadataService) {}

  /**
   * Extend a offer with other peripheral and aggregated data
   * @param offer The offer object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendOffer(offer: Offer, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    const { network, quoteAddress, baseAddress } = offer.market;

    try {
      if (!offer.priceUsd && ((select.includes(`priceUsd`) && !isZero(offer.price)) || !select.length)) {
        offer.priceUsd = await this.metadataSrv.tryToUsd(network, offer.price, quoteAddress);
      }

      if (!offer.amountUsd && ((select.includes(`amountUsd`) && !isZero(offer.amount)) || !select.length)) {
        offer.amountUsd = await this.metadataSrv.tryToUsd(network, offer.amount, baseAddress);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

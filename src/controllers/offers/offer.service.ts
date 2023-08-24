import { Injectable } from '@nestjs/common';
import Offer from '../../models/offer';

@Injectable()
export class OfferService {
  /**
   * Extend a offer with other peripheral and aggregated data
   * @param offer The offer object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendOffer(offer: Offer, select = []) {
    try {
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

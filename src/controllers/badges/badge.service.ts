import { Injectable } from '@nestjs/common';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';

@Injectable()
export class BadgeService {
  /**
   * Extend a badge object with other peripheral and aggregated data
   * @param badge The badge object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendBadge(badge: Badge, select = []) {
    try {
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Extend a badge grant object with other peripheral and aggregated data
   * @param grant The badge grant object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendBadgeGrant(grant: BadgeGrant, select = []) {
    try {
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

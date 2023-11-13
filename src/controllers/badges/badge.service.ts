import { Injectable } from '@nestjs/common';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';

@Injectable()
export class BadgeService {
  /**
   * Extend a badge object with other peripheral and aggregated data
   * @param _badge The badge object
   * @param _select Select the extended field to be returned
   * @returns
   */
  async extendBadge(_badge: Badge, _select = []) {
    try {
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Extend a badge grant object with other peripheral and aggregated data
   * @param _grant The badge grant object
   * @param _select Select the extended field to be returned
   * @returns
   */
  async extendBadgeGrant(_grant: BadgeGrant, _select = []) {
    try {
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

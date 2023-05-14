import { BaseModel } from './base';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';

// BadgeScope indicate what market action require a given badge
export enum BadgeScope {
  PUT = 'put',
  SWAP = 'swap',
  MEDIATE = 'mediate',
}

/**
 * MarketBadge represents a badge requirement for a market
 */
export default class MarketBadge extends BaseModel {
  // The network where the badge was granted
  network: string = undefined;
  // Market address
  marketAddress: string = undefined;
  // The badge assigned to the grantee
  badge: string = undefined;
  // The path part of a badge
  path: string = undefined;
  // The market action (or scope) the badge is required for
  scope: BadgeScope = undefined;

  constructor(init?: Partial<MarketBadge>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'market_badges';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_badge_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MarketBadge;
    object.object = 'market_badge';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The grant data
   * @param txn The transaction object
   */
  static create(data: Partial<MarketBadge>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MarketBadge>, txn?: Transaction): Promise<MarketBadge> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * Delete records by market address
   * @param network The network name
   * @param address The address of the target market
   * @param txn Optional transaction object
   */
  static deleteByMarketAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).where({ network }).where('marketAddress', 'ilike', address).hardDelete();
  }
}

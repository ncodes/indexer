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
 * MarketBadge represents a badge assignment to a market and its liquidities
 */
export default class MarketBadge extends BaseModel {
  // The network where the badge was granted
  network: string = undefined;
  // Market address
  marketAddress: string = undefined;
  // The provider's address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
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

  /**
   * Delete records belonging to a provider in a market
   * @param network The network name
   * @param market The market address
   * @param provider The provider address
   * @param lid The provider's liquidity ID
   * @param txn Optional transaction object
   */
  static deleteByMarketAndProvider(network: string, market: string, provider: string, lid?: number, txn?: Transaction) {
    return this.query(txn)
      .where({ network })
      .where('marketAddress', 'ilike', market)
      .where('provider', 'ilike', provider)
      .where((q) => {
        if (lid) return q.where({ lid });
      })
      .hardDelete();
  }
}

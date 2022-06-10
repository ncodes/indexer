import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * PermittedTrader represents a permitted trader
 */
export default class PermittedTrader extends BaseModel {
  // The network name
  network: string;
  // The market ID
  marketId: string;
  // The permitted address
  address: string;

  constructor(init?: Partial<PermittedTrader>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'permitted_trader_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PermittedTrader;
    object.object = 'permitted_trader';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'permitted_traders';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<PermittedTrader>, txn?: Transaction): Promise<PermittedTrader> {
    return new Promise(async (resolve, reject) => {
      const softDeleted = await this.query(txn).where(data).whereDeleted().first();
      if (softDeleted) {
        await this.query(txn).where('id', softDeleted.id).patch({ deletedAt: null });
        delete softDeleted.deletedAt;
        return resolve(softDeleted);
      }

      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PermittedTrader>, txn?: Transaction): Promise<PermittedTrader> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find a record my network, market ID and address
   * @param network The network name
   * @param marketId The market ID
   * @param address The permitted address
   * @param txn Optional transaction object
   */
  static findByNetworkMarketIdAndAddress(
    network: string,
    marketId: string,
    address: string,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .first();
  }

  /**
   * remove a permission
   * @param network The network name
   * @param marketId The market ID
   * @param address The permitted address
   * @param txn Optional transaction object
   */
  static remove(network: string, marketId: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .delete();
  }

  /**
   * searchByNetworkMarketID searches for records by network and market ID
   * @param network The network name
   * @param marketId The market ID
   * @param limit The result limit
   * @param prevSerial The last serial number seen (for pagination)
   * @param txn Optional transaction object
   */
  static searchByNetworkMarketID(
    network: string,
    marketId: string,
    limit: number,
    prevSerial: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn).where('network', 'ILIKE', network);
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (prevSerial) q = q.where('sn', '<', prevSerial);
    if (limit) q = q.limit(limit);
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

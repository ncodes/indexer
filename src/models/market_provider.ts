import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * MarketProvider represents a liquidity provider of a market
 */
export default class MarketProvider extends BaseModel {
  // The network name
  network: string;
  // The market ID
  marketId: string;
  // The provider's address
  address: string;

  constructor(init?: Partial<MarketProvider>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_provider_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MarketProvider;
    object.object = 'market_provider';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'market_providers';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MarketProvider>, txn?: Transaction): Promise<MarketProvider> {
    return new Promise(async (resolve, reject) => {
      // Find a matching soft-deleted user
      const softDeletedUser = await this.query(txn)
        .where('network', 'ILIKE', data.network)
        .where((q) => {
          if (data.marketId) q.where('marketId', 'ILIKE', data.marketId);
        })
        .where((q) => {
          if (data.address) q.where('address', 'ILIKE', data.address);
        })
        .whereDeleted()
        .first();

      // Undelete the soft-deleted user and return it
      if (softDeletedUser) {
        await this.query(txn).where('id', softDeletedUser.id).undelete();
        delete softDeletedUser.deletedAt;
        return resolve(softDeletedUser);
      }

      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * getByAddress finds a record by their provider address
   * @param email The provider address
   * @param txn Optional transaction object
   */
  static getByAddress(email: string, txn?: Transaction): Promise<MarketProvider> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where('address', 'ILIKE', email)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MarketProvider>, txn?: Transaction): Promise<MarketProvider> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(
    id: string,
    udp: Partial<MarketProvider>,
    txn?: Transaction,
  ): Promise<MarketProvider> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Delete a record
   * @param network The network name
   * @param marketId The market ID
   * @param address The provider's address
   * @param txn The transaction object
   */
  static remove(network: string, marketId: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ILIKE', network)
      .where('marketId', 'ILIKE', marketId)
      .where('address', 'ILIKE', address)
      .delete();
  }

  /**
   * count returns the count of record matching q
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param txn Optional transaction object
   */
  static countByNetworkOrMarket(network: string, marketId: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn).where('network', 'ILIKE', network);
      if (marketId) q = q.where('marketId', 'ILIKE', marketId);
      q.count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Search finds records with key-set pagination
   * @param network The network name
   * @param marketId The market ID
   * @param limit The number of records to return.
   * @param offset The offset value
   */
  static search(network: string, marketId: string, limit: number, offset: number) {
    let q = this.query()
      .select(raw('*, count(*) over() as "__queryCount"'))
      .where('network', 'ILIKE', network);
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

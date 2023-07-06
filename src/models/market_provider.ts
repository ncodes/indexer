import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * LiquidityProvider represents a liquidity provider of a market
 */
export default class LiquidityProvider extends BaseModel {
  // The network name
  network: string;
  // The market address
  marketAddress: string;
  // The provider's address
  address: string;

  constructor(init?: Partial<LiquidityProvider>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_provider_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as LiquidityProvider;
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
  static create(data: Partial<LiquidityProvider>, txn?: Transaction): Promise<LiquidityProvider> {
    return new Promise(async (resolve, reject) => {
      // Find a matching soft-deleted user
      const softDeletedUser = await this.query(txn)
        .where('network', 'ILIKE', data.network)
        .where((q) => {
          if (data.marketAddress) q.where('marketAddress', 'ILIKE', data.marketAddress);
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
  static getByAddress(email: string, txn?: Transaction): Promise<LiquidityProvider> {
    return new Promise((resolve, reject) => {
      this.query(txn).where('address', 'ILIKE', email).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<LiquidityProvider>, txn?: Transaction): Promise<LiquidityProvider> {
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
  static updateById(id: string, udp: Partial<LiquidityProvider>, txn?: Transaction): Promise<LiquidityProvider> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Delete a record
   * @param network The network name
   * @param marketAddress The market ID
   * @param address The provider's address
   * @param txn The transaction object
   */
  static remove(network: string, marketAddress: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ILIKE', network)
      .where('marketAddress', 'ILIKE', marketAddress)
      .where('address', 'ILIKE', address)
      .delete();
  }

  /**
   * count returns the count of record matching q
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param txn Optional transaction object
   */
  static countByNetworkOrMarket(network: string, marketAddress: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn).where('network', 'ILIKE', network);
      if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
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
   * @param marketAddress The market ID
   * @param limit The number of records to return.
   * @param offset The offset value
   */
  static search(network: string, marketAddress: string, limit: number, offset: number) {
    let q = this.query().select(raw('*, count(*) over() as "__queryCount"')).where('network', 'ILIKE', network);
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * MarketManagerDelegate contains information about market manager delegate
 */
export default class MarketManagerDelegate extends BaseModel {
  network: string = undefined;
  address: string = undefined;

  constructor(init?: Partial<MarketManagerDelegate>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'market_manager_delegates';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'mm_delegate_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MarketManagerDelegate;
    object.object = 'mm_delegate';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<MarketManagerDelegate>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MarketManagerDelegate>, txn?: Transaction): Promise<MarketManagerDelegate> {
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
   * Find a record by network and address
   * @param network The network
   * @param address The address
   * @param txn Optional transaction object
   */
  static findByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, address }).first();
  }

  /**
   * Delete a record by network and address
   * @param network The network
   * @param address The address
   * @param txn Optional transaction object
   */
  static deleteByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, address }).delete();
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<MarketManagerDelegate>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }
}

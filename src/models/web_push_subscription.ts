import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * WebPushSubscription represents a web push subscription
 */
export default class WebPushSubscription extends BaseModel {
  // The network name
  network: string;
  // The subscribe address
  address: string;
  // The subscription
  subscription: string;

  constructor(init?: Partial<WebPushSubscription>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'web_sub_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as WebPushSubscription;
    object.object = 'web_sub';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'web-push-subscriptions';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<WebPushSubscription>, txn?: Transaction): Promise<WebPushSubscription> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<WebPushSubscription>, txn?: Transaction): Promise<WebPushSubscription> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
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
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<WebPushSubscription>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Delete by network and address
   * @param network The network name
   * @param address The address
   * @param txn
   * @returns
   */
  static deleteByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).where({ network }).where('address', 'ilike', address).hardDelete();
  }

  /**
   * Get by network and address
   * @param network The network name
   * @param address The address
   * @param txn Optional transaction object
   * @returns
   */
  static getByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).where({ network }).where('address', 'ilike', address).first();
  }
}

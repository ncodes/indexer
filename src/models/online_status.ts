import * as moment from 'moment';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * OnlineStatus tracks the online status of an address
 */
export default class OnlineStatus extends BaseModel {
  // The network name
  network: string;
  // The subscribe address
  address: string;
  // The order ID
  orderId: number;
  // The offer ID
  offerId: number;

  constructor(init?: Partial<OnlineStatus>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'online_status_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as OnlineStatus;
    object.object = 'online_status';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'online-statuses';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<OnlineStatus>, txn?: Transaction): Promise<OnlineStatus> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<OnlineStatus>, txn?: Transaction): Promise<OnlineStatus> {
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
  static updateById(id: string, udp: Partial<OnlineStatus>, txn?: Transaction) {
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
  static delete(network: string, address: string, orderId?: number, offerId?: number, txn?: Transaction) {
    const q = this.query(txn).where({ network }).where('address', 'ilike', address);
    if (orderId != undefined) q.where({ orderId });
    else q.whereNull('orderId');
    if (offerId != undefined) q.where({ offerId });
    else q.whereNull('offerId');
    return q.hardDelete();
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

  /**
   * Check if a user is online
   * @param network The network name
   * @param address The address of the user
   * @param orderId The order ID
   * @param offerId The offer ID
   * @param activeWindow The duration in seconds to consider a user online
   * @param txn Optional transaction object
   * @returns
   */
  static async isOnline(
    network: string,
    address: string,
    orderId?: number,
    offerId?: number,
    activeWindow = 20,
    txn?: Transaction,
  ) {
    const q = this.query(txn).where({ network }).where('address', 'ilike', address);

    if (orderId != undefined) q.where({ orderId });
    else q.whereNull('orderId');

    if (offerId != undefined) q.where({ offerId });
    else q.whereNull('offerId');

    const record = await q.orderBy('updatedAt', 'DESC').first();
    if (!record) return false;

    return moment().diff(moment(record.updatedAt), 'second') <= activeWindow;
  }
}

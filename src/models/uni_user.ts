import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * UniUser represents a uniswap user
 */
export default class UniUser extends BaseModel {
  address: string;
  claimSignature: string;
  claimed: boolean;

  constructor(init?: Partial<UniUser>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'uni_user_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as UniUser;
    object.object = 'uni_user';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'uni_users';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<UniUser>, txn?: Transaction): Promise<UniUser> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<UniUser>, txn?: Transaction): Promise<UniUser> {
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
   * getByAddress finds a record by address
   * @param address The record address
   * @param txn Optional transaction object
   */
  static getByAddress(address: string, txn?: Transaction) {
    return this.query(txn).where('address', 'ilike', address).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<UniUser>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { toDec } from './../common/common';
import { BaseModel } from './base';
import TapSpend from './tap_spend';

/**
 * Tap represents a tap event
 */
export default class Tap extends BaseModel {
  userId: string;
  virtual: boolean;

  constructor(init?: Partial<Tap>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'tap_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Tap;
    object.object = 'tap';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'taps';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Tap>, txn?: Transaction): Promise<Tap> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Tap>, txn?: Transaction): Promise<Tap> {
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
  static updateById(id: string, udp: Partial<Tap>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Get the tap count for a user
   * @param userId The user ID
   * @param txn Optional transaction object
   * @returns
   */
  static async getTapCount(userId: string, txn?: Transaction) {
    const totalSpend = await TapSpend.getTotalSpend(userId, undefined, txn);

    return this.query(txn)
      .where('userId', userId)
      .whereNotDeleted()
      .count()
      .first()
      .then((res) => {
        return res ? toDec(res.count).sub(totalSpend).toFixed() : '0';
      });
  }
}

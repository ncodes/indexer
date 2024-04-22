import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { TapSpendType } from '../controllers/airdrop/constants';
import { BaseModel } from './base';

/**
 * TapSpend represents a spent tap event
 */
export default class TapSpend extends BaseModel {
  userId: string;
  type: TapSpendType;
  amount: string;

  constructor(init?: Partial<TapSpend>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'tap_spend_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TapSpend;
    object.object = 'tap_spend';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'tap_spends';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<TapSpend>, txn?: Transaction): Promise<TapSpend> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<TapSpend>, txn?: Transaction): Promise<TapSpend> {
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
  static updateById(id: string, udp: Partial<TapSpend>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Get the sum of tap spend for a user
   * @param userId The user ID
   * @param type The spend type
   * @param txn Optional transaction object
   * @returns
   */
  static getTotalSpend(userId: string, type?: TapSpendType, txn?: Transaction): Promise<string> {
    return this.query(txn)
      .where({ userId })
      .where((q) => {
        if (type) {
          q.where({ type });
        }
      })
      .sum('amount')
      .first()
      .then((res) => (res as any).sum || '0');
  }

  /**
   * Count the number of tap spend events for a user
   * @param userId The user ID
   * @param type The spend type
   * @param txn Optional transaction object
   * @returns
   */
  static async countSpend(userId: string, type?: TapSpendType, txn?: Transaction): Promise<number> {
    return this.query(txn)
      .where({ userId })
      .where((q) => {
        if (type) {
          q.where({ type });
        }
      })
      .count()
      .first()
      .then((res) => (res ? parseInt(res.count) : 0));
  }
}

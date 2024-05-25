import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * TPS represents taps per second logs
 */
export default class TPS extends BaseModel {
  userId: string;
  tps: number;

  constructor(init?: Partial<TPS>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'tps' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TPS;
    object.object = 'tps';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'tps';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<TPS>, txn?: Transaction): Promise<TPS> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<TPS>, txn?: Transaction): Promise<TPS> {
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
  static updateById(id: string, udp: Partial<TPS>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Get the average TPS for a user.
   * @param userId The user ID (optional)
   * @param startDate The start date (optional)
   * @param endDate The end date (optional)
   * @param txn Optional transaction object
   */
  static async getUserAvgTPS(userId?: string, startDate?: string, endDate?: string, txn?: Transaction) {
    const res = await this.query(txn)
      .where((q) => {
        if (userId) q = q.where('userId', userId);
        return q;
      })
      .where((q) => {
        if (startDate) q = q.where('createdAt', '>=', startDate);
        if (endDate) q = q.where('createdAt', '<=', endDate);
        return q;
      })
      .avg('tps')
      .groupBy('userId')
      .first();
    return Math.ceil((res as any).avg || '0');
  }
}

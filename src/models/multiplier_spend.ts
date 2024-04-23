import * as moment from 'moment';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * MultiplierSpend represents a spent multiplier event
 */
export default class MultiplierSpend extends BaseModel {
  userId: string;
  amount: string;
  taps: string;

  constructor(init?: Partial<MultiplierSpend>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'multi_spend_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MultiplierSpend;
    object.object = 'multi_spend';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'multiplier_spends';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MultiplierSpend>, txn?: Transaction): Promise<MultiplierSpend> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MultiplierSpend>, txn?: Transaction): Promise<MultiplierSpend> {
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
  static updateById(id: string, udp: Partial<MultiplierSpend>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Get the sum of spend for a user
   * @param userId The user ID
   * @param txn Optional transaction object
   * @returns
   */
  static getTotalSpend(userId: string, txn?: Transaction): Promise<string> {
    return this.query(txn)
      .where({ userId })
      .sum('amount')
      .first()
      .then((res) => (res as any).sum || '0');
  }

  /**
   * Get the sum of taps for a user
   * @param userId The user ID
   * @param txn Optional transaction object
   * @returns
   */
  static getTotalTaps(userId: string, txn?: Transaction): Promise<string> {
    return this.query(txn)
      .where({ userId })
      .sum('taps')
      .first()
      .then((res) => (res as any).sum || '0');
  }

  /**
   * Get sum of spend for a user since the given period
   * @param userId The user ID
   * @param period The period from when to check from (second)
   * @param txn
   * @returns
   */
  static getTotalSpendFrom(userId: string, period: number, txn?: Transaction): Promise<string> {
    return this.query(txn)
      .where({ userId })
      .where('createdAt', '>=', moment().subtract(period, 's').toISOString())
      .sum('amount')
      .first()
      .then((res) => (res as any).sum || '0');
  }
}

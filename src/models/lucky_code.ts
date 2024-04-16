import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * LuckyCode represents a lucky code entry
 */
export default class LuckyCode extends BaseModel {
  // A unique identifier
  code: string;
  // The owner of the code
  owner: string;
  // Whether the amount is randomly selected within a min-max range
  random: boolean;
  // The minimum amount (Must be in highest denomination of the token)
  minAmount: string;
  // The maximum amount (Must be in highest denomination of the token)
  maxAmount: string;
  // The actual amount of the code (Must be in lowest denomination of the token)
  amount: string;
  // Whether the code is used
  claimed: boolean;

  constructor(init?: Partial<LuckyCode>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'lucky_code_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as LuckyCode;
    object.object = 'lucky_code';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'lucky_codes';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<LuckyCode>, txn?: Transaction): Promise<LuckyCode> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<LuckyCode>, txn?: Transaction): Promise<LuckyCode> {
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
   * Get a record by code
   * @param code The code of the record
   * @param txn Optional transaction object
   * @returns
   */
  static getByCode(code: string, txn?: Transaction) {
    return this.query(txn).where('code', 'ilike', code).whereNotDeleted().first();
  }

  /**
   * Get a record by code and address
   * @param code The code to search for
   * @param address The address to search for
   * @param txn Optional transaction object
   * @returns
   */
  static getByCodeAndAddress(code: string, address: string, txn?: Transaction) {
    return this.query(txn).where('code', 'ilike', code).where('owner', 'ilike', address).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<LuckyCode>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

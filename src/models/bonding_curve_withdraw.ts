import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * BondingCurveWithdraw represents the bond curve withdraw
 */
export default class BondingCurveWithdraw extends BaseModel {
  address: string = undefined;
  amount: string = undefined;

  constructor(init?: Partial<BondingCurveWithdraw>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'bonding_curve_withdraws';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'bcwdr_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as BondingCurveWithdraw;
    object.object = 'bcwdr';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The issuer data
   * @param txn The transaction object
   */
  static create(data: Partial<BondingCurveWithdraw>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<BondingCurveWithdraw>, txn?: Transaction): Promise<BondingCurveWithdraw> {
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
   * Updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<BondingCurveWithdraw>, txn?: Transaction): Promise<BondingCurveWithdraw> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  static findByAddress(address: string) {
    return this.query().where('address', address).whereNotDeleted().orderBy('claimId', 'asc');
  }
}

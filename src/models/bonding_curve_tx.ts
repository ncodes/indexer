import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * BondingCurveTx represents the bond curve transaction
 */
export default class BondingCurveTx extends BaseModel {
  buy: boolean = undefined;
  address: string = undefined;
  input: string = undefined;
  output: string = undefined;
  fee: string = undefined;

  constructor(init?: Partial<BondingCurveTx>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'bonding_curve_txs';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'bctx_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as BondingCurveTx;
    object.object = 'bctx';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The issuer data
   * @param txn The transaction object
   */
  static create(data: Partial<BondingCurveTx>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<BondingCurveTx>, txn?: Transaction): Promise<BondingCurveTx> {
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
  static updateById(id: string, udp: Partial<BondingCurveTx>, txn?: Transaction): Promise<BondingCurveTx> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  static findByAddress(address: string) {
    return this.query().where('address', address).whereNotDeleted().orderBy('claimId', 'asc');
  }

  static findSumOfOutputsByAddress(address: string) {
    return this.query()
      .sum('output')
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .then((res) => {
        return (res[0] as any).sum;
      });
  }
}

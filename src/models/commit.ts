import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';
import { randStr } from '../common/common';

/**
 * Commit represents a commit on a dispute
 */
export default class Commit extends BaseModel {
  // The network name
  network: string;
  // The address of the committer
  committer: string;
  // The market ID joined
  marketAddress: string;
  // The order ID
  orderId: number;
  // The dispute ID
  disputeId: number;
  // The committed hash
  hash: string;

  /*** Not Persisted **/
  drafted: boolean;

  constructor(init?: Partial<Commit>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'commit_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Commit;
    object.object = 'commit';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'commits';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Commit>, txn?: Transaction): Promise<Commit> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Commit>, txn?: Transaction): Promise<Commit> {
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
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Commit>, txn?: Transaction): Promise<Commit> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Reveal represents a reveal on a dispute
 */
export default class Reveal extends BaseModel {
  // The network name
  network: string;
  // The address of the committer
  revealer: string;
  // The market ID joined
  marketId: string;
  // The order ID
  orderId: number;
  // The dispute ID
  disputeId: number;
  // The revealed vote
  vote: string;

  /*** Not Persisted **/
  drafted: boolean;

  constructor(init?: Partial<Reveal>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'reveal_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Reveal;
    object.object = 'reveal';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'reveals';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Reveal>, txn?: Transaction): Promise<Reveal> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Reveal>, txn?: Transaction): Promise<Reveal> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<Reveal> {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Reveal>, txn?: Transaction): Promise<Reveal> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }
}

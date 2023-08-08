import { randStr } from '../common/common';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Draft represents a ticket draft event
 */
export default class Draft extends BaseModel {
  // The network name
  network: string;
  // The owner of the ticket
  owner: string;
  // The index of the ticket
  index: number;
  // The market ID joined
  marketAddress: string;
  // The ticket ID
  ticketId: string;
  // The swap order ID
  orderId: number;
  // The dispute index
  disputeIndex: number;
  // The dispute ID
  disputeId: string;

  constructor(init?: Partial<Draft>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'draft_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Draft;
    object.object = 'draft';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'drafts';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Draft>, txn?: Transaction): Promise<Draft> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Draft>, txn?: Transaction): Promise<Draft> {
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
  static updateById(id: string, udp: Partial<Draft>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Get by dispute ID
   * @param network The network name
   * @param marketAddress The market ID
   * @param orderId The order ID
   * @param disputeIndex The dispute ID
   * @param txn Optional transaction object
   */
  static getAll(network: string, marketAddress: string, orderId: number, disputeIndex: number, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where('marketAddress', 'ilike', marketAddress)
      .where({ disputeIndex, orderId });
  }
}

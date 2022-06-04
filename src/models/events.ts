import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Event represents a transaction log
 */
export default class Event extends BaseModel {
  network: string;
  signature: string;
  blockNumber: number;
  txIndex: number;
  logIndex: number;

  constructor(init?: Partial<Event>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'event_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const event = super.$formatJson(json) as Event;
    event.object = 'event';
    return event;
  }

  static get tableName() {
    return 'events';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create creates a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Event>, txn?: Transaction): Promise<Event> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * create a record
   * @param signature The event signature
   * @param blockNumber The event block number
   * @param txIndex The transaction index o
   * @param logIndex The log index
   * @param txn Optional transaction object
   */
  static async exists(
    signature: string,
    blockNumber: number,
    txIndex: number,
    logIndex: number,
    txn?: Transaction,
  ): Promise<boolean> {
    try {
      const event = await this.query(txn)
        .where({ signature, blockNumber, txIndex, logIndex })
        .whereNotDeleted()
        .first();
      return Promise.resolve(event !== undefined);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * find finds a record
   * @param q the query parameter
   */
  static find(q: Partial<Event>): Promise<Event> {
    return new Promise((resolve, reject) => {
      this.query()
        .where(q)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }
}

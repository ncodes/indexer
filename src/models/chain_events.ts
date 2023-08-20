import { randStr } from "../common/common";
import Objection, { Transaction } from "objection";
import { BaseModel } from "./base";

/**
 * ChainEvent represents a contract event on the blockchain
 */
export default class ChainEvent extends BaseModel {
  network: string;
  signature: string;
  blockNumber: number;
  txIndex: number;
  logIndex: number;

  constructor(init?: Partial<ChainEvent>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'chain_event_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const event = super.$formatJson(json) as ChainEvent;
    event.object = 'chain_event';
    return event;
  }

  static get tableName() {
    return 'chain_events';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create creates a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<ChainEvent>, txn?: Transaction): Promise<ChainEvent> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
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
  static find(q: Partial<ChainEvent>): Promise<ChainEvent> {
    return new Promise((resolve, reject) => {
      this.query().where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }
}

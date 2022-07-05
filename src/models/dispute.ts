import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Dispute represents a swap dispute
 */
export default class Dispute extends BaseModel {
  // The network name
  network: string;
  // The creator of the dispute
  creator: string;
  // The defendant of the dispute
  defendant: string;
  // The amount paid as deposit
  deposit: string;
  // The market ID joined
  marketId: string;
  // The order ID
  orderId: number;
  // The dispute ID
  disputeId: number;
  // The number of mediators required
  numMediators: number;
  // The number of mediators drafted
  numMediatorsDrafted: number;
  // Indicates the creator's preferred outcome
  wantRelease: boolean;
  // Indicates whether this dispute is an appeal
  appeal: boolean;
  // The evidence submission expiry time
  evidenceEndAt: string;
  // The vote commit end time
  commitEndAt: string;
  // The vote reveal end time
  revealEndAt: string;
  // The voting end time
  predictEndAt: string;
  // The time after which appeal is no longer possible
  appealEndAt: string;
  // Indicates whether the dispute has been executed
  executed: boolean;
  // Indicates whether the dispute outcome was release or cancelled
  released: boolean;
  // Indicates the dispute was abandoned
  abandoned: boolean;

  /*** Not Persisted **/
  drafted: boolean;

  constructor(init?: Partial<Dispute>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'dispute_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Dispute;
    object.object = 'dispute';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'disputes';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Dispute>, txn?: Transaction): Promise<Dispute> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Dispute>, txn?: Transaction): Promise<Dispute> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<Dispute> {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Dispute>, txn?: Transaction): Promise<Dispute> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * countByNetworkAndMarketId counts dispute associated with a market order
   * @param network The network name
   * @param marketId The marker ID
   * @param orderId The order ID
   * @param txn Optional transaction object
   */
  static countByNetworkAndMarketIdAndOrderId(
    network: string,
    marketId: string,
    orderId: number,
    txn?: Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where({ network, orderId })
        .where('marketId', 'ilike', marketId)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Get a specific dispute
   * @param network The network name
   * @param marketId The marker ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param txn Optional transaction object
   */
  static get(
    network: string,
    marketId: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ): Promise<Dispute> {
    return this.query(txn)
      .where({ network, orderId, disputeId })
      .where('marketId', 'ilike', marketId)
      .whereNotDeleted()
      .first();
  }
}

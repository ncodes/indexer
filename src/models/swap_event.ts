import { randStr } from '../common/common';
import Objection, { Model, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Offer from './offers';
import Swap from './swap';
import Dispute from './dispute';

export enum SwapEvents {
  Paid = 'paid',
  Released = 'released',
  Cancelled = 'cancelled',
  Disputed = 'disputed',
  Drafted = 'drafted',
  Committed = 'committed',
  Revealed = 'revealed',
  Executed = 'executed',
  Undrafted = 'undrafted',
}

/**
 * SwapEvent represents a swap event
 */
export default class SwapEvent extends BaseModel {
  // The network name
  network: string = undefined;
  // The market address
  marketAddress: string = undefined;
  // The swap order ID
  orderId: number = undefined;
  // The dispute ID
  disputeId: number = undefined;
  // The event creator
  creator: string = undefined;
  // The draftee address
  draftee: string = undefined;
  // The revealed vote
  vote: string = undefined;
  // The offer event action
  action: SwapEvents = undefined;

  /** Relations */
  dispute: Dispute;
  swap: Swap;

  constructor(init?: Partial<SwapEvent>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'swap_event_' + randStr(24);
  }

  $beforeUpdate() {
    super.$beforeUpdate();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as SwapEvent;
    object.object = 'swap_event';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'swap_events';
  }

  static get relationMappings() {
    return {
      swap: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: ['swap_events.network', 'swap_events.orderId'],
          to: ['swaps.network', 'swaps.orderId'],
        },
      },
      dispute: {
        relation: Model.BelongsToOneRelation,
        modelClass: Dispute,
        join: {
          from: ['swap_events.network', 'swap_events.marketAddress', 'swap_events.orderId', 'swap_events.disputeId'],
          to: ['disputes.network', 'disputes.marketAddress', 'disputes.orderId', 'disputes.orderId'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<SwapEvent>, txn?: Transaction): Promise<SwapEvent> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
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
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<SwapEvent>, txn?: Transaction) {
    return this.query(txn).where(q).whereNotDeleted().first();
  }

  /**
   * Search for records
   * @param network The network name
   * @param marketAddress The market address
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param limit The limit
   * @param offset The offset
   * @param txn Optional transaction object
   */
  static search(
    network: string,
    marketAddress?: string,
    orderId?: number,
    disputeId?: number,
    limit?: number,
    offset?: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn)
      .select('*', raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where((q) => {
        if (network) q = q.where('network', network);
        if (marketAddress) q = q.where('marketAddress', 'ilike', marketAddress);
        if (orderId) q = q.where('orderId', orderId);
        if (disputeId) q = q.where('disputeId', disputeId);
        return q;
      })
      .withGraphFetched('[dispute,swap]')
      .orderBy('createdAt', 'desc');
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q;
  }
}

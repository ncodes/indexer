import { randStr } from '../common/common';
import Objection, { Model, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Offer from './offers';
import Swap from './swap';

export enum LiquidityEvents {
  Add = 'add',
  Remove = 'remove',
  Swap = 'swap',
  Offer = 'offer',
  Pause = 'pause',
  ManagerUpdate = 'manager_update',
  TargetUpdate = 'target_update',
  PriceUpdate = 'price_update',
  SwapLimitUpdate = 'swap_limit_update',
  TimeToPayUpdate = 'time_to_pay_update',
}

/**
 * LiquidityEvent represents a liquidity event
 */
export default class LiquidityEvent extends BaseModel {
  // The network name
  network: string = undefined;
  // The provider address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
  // The market address
  marketAddress: string = undefined;
  // The creator or initiator of the liquidity event
  creator: string = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The price of the liquidity
  price: string = undefined;
  // The minimum swap amount
  minSwap: string = undefined;
  // The maximum swap amount
  maxSwap: string = undefined;
  // The specific address allowed to swap the liquidity
  target: string = undefined;
  // The time required for taker to make payment
  timeToPay: number = undefined;
  // The liquidity manager
  manager: string = undefined;
  // Indicates that the liquidity has been paused
  paused: boolean = undefined;
  // The offer ID
  offerId: number = undefined;
  // The swap order ID
  orderId: number = undefined;
  // The offer event action
  action: LiquidityEvents = undefined;

  /** Relations */
  offer: Offer;
  swap: Swap;

  constructor(init?: Partial<LiquidityEvent>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_event_' + randStr(24);
  }

  $beforeUpdate() {
    super.$beforeUpdate();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as LiquidityEvent;
    object.object = 'liquidity_event';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'liquidity_events';
  }

  static get relationMappings() {
    return {
      offer: {
        relation: Model.BelongsToOneRelation,
        modelClass: Offer,
        join: {
          from: ['liquidity_events.network', 'liquidity_events.offerId'],
          to: ['offers.network', 'offers.offerId'],
        },
      },
      swap: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: ['liquidity_events.network', 'liquidity_events.orderId'],
          to: ['swaps.network', 'swaps.orderId'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<LiquidityEvent>, txn?: Transaction): Promise<LiquidityEvent> {
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
  static find(q: Partial<LiquidityEvent>, txn?: Transaction) {
    return this.query(txn).where(q).whereNotDeleted().first();
  }

  /**
   * Search for records
   * @param network The network name
   * @param marketAddress The market address
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param limit The limit
   * @param offset The offset
   * @param txn Optional transaction object
   */
  static search(
    network: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
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
        if (provider) q = q.where('provider', 'ilike', provider);
        if (lid) q = q.where('lid', lid);
        return q;
      })
      .withGraphFetched('[offer,swap]')
      .orderBy('createdAt', 'desc');
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q;
  }
}

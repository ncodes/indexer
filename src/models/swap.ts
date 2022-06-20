import * as crand from 'crypto-random-string';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import * as moment from 'moment';
import Decimal from 'decimal.js';
import { ToDec } from '../common/common';

/**
 * Swap represents a swap operation
 */
export default class Swap extends BaseModel {
  // The network name
  network?: string;
  // The market ID
  marketId?: string;
  // The base asset symbol
  base: string;
  // The base asset address
  baseAddress: string;
  // The quote asset symbol
  quote: string;
  // The quote asset address
  quoteAddress: string;
  // The order ID (if swap created an order)
  orderId?: number;
  // The liquidity provider's address
  provider?: string;
  // The swap initiator's address
  taker?: string;
  // The output amount of the swap
  amount?: string;
  // The price of 1 unit of output asset
  price?: string;
  // Indicates whether the order is an instance swap
  instant?: boolean;
  // Indicates whether the swap was marked as paid.
  paid?: boolean;
  // Indicates whether the swap was cancelled
  cancelled?: boolean;
  // Indicates whether the swap was released
  released?: boolean;
  // Indicates whether the swap was released/paid via dispute resolution
  byDispute?: boolean;
  // The cost of the swapping amount
  cost?: string;
  // The amount from which fee was charged
  chargedAmount: string;
  // Indicates whether the charged amount is the swap cost or swap amount
  costCharged: boolean;
  // The protocol fee base point
  protocolFeeBP: number;
  // The protocol fee charged
  protocolFee: string;
  // The market fee base point
  marketFeeBP: number;
  // The market fee charged
  marketFee: string;
  // The total fee charged (market + protocol fees)
  totalFee: string;

  constructor(init?: Partial<Swap>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'swap_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Swap;
    object.object = 'swap';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'swaps';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find a record by order ID
   * @param orderId the order ID
   * @param txn Optional transaction object
   */
  static getByOrderId(orderId: number, txn?: Transaction): Promise<Swap> {
    return this.query(txn).where({ orderId }).whereNotDeleted().first();
  }

  /**
   * updateById updates a swap by ID
   * @param id the swap id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * updateByOrderId updates a swap by order ID
   * @param orderId The order ID
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateByOrderId(orderId: number, udp: Partial<Swap>, txn?: Transaction): Promise<number> {
    return this.query(txn).where({ orderId }).whereNotDeleted().patch(udp);
  }

  /**
   * count by network and market
   * @param network The network name
   * @param marketId The market ID
   * @param provider The provider address
   * @param instant? Filter by instant swap
   * @param minutesAgo? Filter between now and some minutes ago
   * @param txn? Optional transaction object
   */
  static countByNetworkAndMarketAndProvider(
    network: string,
    marketId: string,
    provider: string,
    instant?: boolean,
    minutesAgo?: number,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn).where({ network }).where('marketId', 'ilike', marketId);
      if (provider) q = q.where('provider', 'ilike', provider);
      if (instant !== undefined) q = q.where({ instant });
      if (minutesAgo)
        q = q.where('createdAt', '>=', moment().subtract(minutesAgo, 'minutes').toISOString());
      q.count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Get the trade volume of a market/provider within now and some time ago.
   * @param network The network name.
   * @param marketId The base asset address
   * @param provider The provider address
   * @param timeAgo The number of minutes ago to use as the start time
   * @param instant? Filter by instant swap
   * @param txn? Optional transaction object
   */
  static getVolume(
    network: string,
    marketId: string,
    provider: string,
    timeAgo: number,
    instant?: boolean,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .select(raw('sum(cast(?? as numeric))', 'amount').as('total'))
        .where('network', network)
        .where('marketId', 'ilike', marketId)
        .where((q) => {
          if (provider !== undefined) q.where('provider', 'ilike', provider);
        })
        .where((q) => {
          if (instant !== undefined) q.where('instant', instant);
        })
        .where('createdAt', '>=', moment().subtract(timeAgo, 'm').toISOString())
        .then((res: any) => {
          return resolve(res[0].total || '0');
        })
        .catch(reject);
    });
  }

  /**
   * Count number of released, cancelled or disputed swaps
   * @param network The network name
   * @param marketId The market ID
   * @param provider The provider address
   * @param released Indicate to return count for released swaps
   * @param cancelled Indicate to return count for cancelled swaps
   * @param disputed Indicate to return count for disputed swaps
   * @param txn
   */
  static countByState(
    network: string,
    marketId: string,
    provider: string,
    released?: boolean,
    cancelled?: boolean,
    disputed?: boolean,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn).where({ network }).where('marketId', 'ilike', marketId);
      if (provider) q = q.where('provider', 'ilike', provider);
      if (released !== undefined) q = q.where({ released });
      if (cancelled !== undefined) q = q.where({ cancelled });
      if (disputed !== undefined) q = q.where({ byDisputed: disputed });
      q.count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Calculate completion rate
   * @param network The network name
   * @param marketId The market ID
   * @param provider The provider address
   * @param txn
   */
  static async getCompletionRate(
    network: string,
    marketId: string,
    provider: string,
    txn?: Objection.Transaction,
  ) {
    const nReleased = await Swap.countByState(
      network,
      marketId,
      provider,
      true,
      undefined,
      undefined,
      txn,
    );
    const nSwaps = await Swap.countByState(
      network,
      marketId,
      provider,
      undefined,
      undefined,
      undefined,
      txn,
    );
    return Promise.resolve(ToDec(nReleased).div(nSwaps).mul(100).toDP(2).toNumber());
  }
}

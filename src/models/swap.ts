import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import * as moment from 'moment';
import { ToDec } from '../common/common';
import Market from './market';
import Liquidity from './liquidity';
import * as _ from 'lodash';

/**
 * Swap represents a swap operation
 */
export default class Swap extends BaseModel {
  // The network name
  network?: string = undefined;
  // The market ID
  marketId?: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // The order ID (if swap created an order)
  orderId?: number = undefined;
  // The liquidity provider's address
  provider?: string = undefined;
  // The swap initiator's address
  taker?: string = undefined;
  // The output amount of the swap
  amount?: string = undefined;
  // The price of 1 unit of output asset
  price?: string = undefined;
  // Indicates whether the order is an instance swap
  instant?: boolean = undefined;
  // Indicates whether the swap was marked as paid.
  paid?: boolean = undefined;
  // Indicates whether the swap was cancelled
  cancelled?: boolean = undefined;
  // Indicates whether the swap was released
  released?: boolean = undefined;
  // Indicates whether the swap was released/paid via dispute resolution
  byDispute?: boolean = undefined;
  // The cost of the swapping amount
  cost?: string = undefined;
  // The amount from which fee was charged
  chargedAmount: string = undefined;
  // Indicates whether the charged amount is the swap cost or swap amount
  costCharged: boolean = undefined;
  // The protocol fee base point
  protocolFeeBP: number = undefined;
  // The protocol fee charged
  protocolFee: string = undefined;
  // The market fee base point
  marketFeeBP: number = undefined;
  // The market fee charged
  marketFee: string = undefined;
  // The total fee charged (market + protocol fees)
  totalFee: string = undefined;
  // The transaction hash where the swap was created
  txHash: string = undefined;

  market: Market;
  liquidity: Liquidity;

  constructor(init?: Partial<Swap>) {
    super();
    Object.assign(this, init);
  }
  static get tableName() {
    return 'swaps';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'swap_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Swap;
    object.object = 'swap';
    delete object.deletedAt;
    return object;
  }

  getPair() {
    return `${this.base}/${this.quote}`.toUpperCase();
  }

  /**
   * Get the address of the on-chain side
   */
  async getOnChainParty() {
    const market = await Market.getByMarketId(this.marketId);
    if (!market) throw new Error('market not found');
    if (market.isInstant()) throw new Error('both participants are on-chain');
    return Promise.resolve(market.isBaseLocal ? this.taker : this.provider);
  }

  /**
   * Get the address of the off-chain side
   */
  async getOffChainParty() {
    const market = await Market.getByMarketId(this.marketId);
    if (!market) throw new Error('market not found');
    if (market.isInstant()) throw new Error('both participants are on-chain');
    return Promise.resolve(market.isBaseLocal ? this.provider : this.taker);
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
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
  static getByOrderId(orderId: number, txn?: Transaction) {
    return this.query(txn).where({ orderId }).whereNotDeleted().first();
  }

  /**
   * find a record by swap ID
   * @param id the swap ID
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).where({ id }).whereNotDeleted().first();
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Swap()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat([
            'id',
            'marketId',
            'network',
            'base',
            'baseAddress',
            'quote',
            'quoteAddress',
            'provider',
            'orderId',
          ]),
        )
      : ['*'];
    return select;
  }

  /**
   * find a record by order ID
   * @param network The network name
   * @param orderId The order ID
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static get(network: string, orderId: number, select = [], txn?: Transaction) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .select(...select)
      .where({ network, orderId })
      .whereNotDeleted()
      .first();
  }

  /**
   * updateById updates a swap by ID
   * @param id the swap id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Swap>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * updateByOrderId updates a swap by order ID
   * @param orderId The order ID
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateByOrderId(orderId: number, udp: Partial<Swap>, txn?: Transaction) {
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
   * @param baseAddress The base address
   * @param provider The provider address
   * @param timeAgo The number of minutes ago to use as the start time
   * @param instant? Filter by instant swap
   * @param txn? Optional transaction object
   */
  static getVolume(
    network: string,
    marketId: string,
    baseAddress: string,
    provider: string,
    timeAgo: number,
    instant?: boolean,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .select(raw('sum(cast(?? as numeric))', 'amount').as('total'))
        .where((q) => {
          if (network) q.where('network', network);
        })
        .where((q) => {
          if (marketId) q.where('marketId', 'ilike', marketId);
        })
        .where((q) => {
          if (baseAddress) q.where('baseAddress', 'ilike', baseAddress);
        })
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
      if (disputed !== undefined) q = q.where({ byDispute: disputed });
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
      false,
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

  /**
   * search for swaps
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param providerOrTaker Filter only where address is provider or taker
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static searchSwaps(
    network: string,
    marketId?: string,
    providerOrTaker?: string,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .select(...select, raw('count(*) over() as' + ' "__queryCount"'))
      .whereNotDeleted()
      .where({ network });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (providerOrTaker) {
      q = q.where((q) => {
        q.orWhere('provider', 'ILIKE', providerOrTaker).orWhere('taker', 'ILIKE', providerOrTaker);
      });
    }
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

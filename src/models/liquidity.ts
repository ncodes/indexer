import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Market from './market';
import * as _ from 'lodash';
import * as moment from 'moment';

/**
 * Liquidity represents a liquidity model
 */
export default class Liquidity extends BaseModel {
  // The liquidity provider's preferred country
  country: string = undefined;
  // The liquidity provider's payment method
  paymentMethod: string = undefined;
  // The network associated with this object
  network: string = undefined;
  // The provider address
  provider: string = undefined;
  // The market ID
  marketId: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The all-time amount of liquidity swapped
  amountSwapped: string = undefined;
  // The price of the liquidity
  price: string = undefined;
  // The minimum swap amount
  minSwap: string = undefined;
  // The maximum swap amount
  maxSwap: string = undefined;
  // The time required for taker to make payment
  timeToPay: number = undefined;
  // The liquidity manager
  manager: string = undefined;
  // Indicates that the liquidity has been paused
  paused: boolean = undefined;
  // The number of open swap orders
  openOrders: number = undefined;
  // The last time this liquidity successfully completed a swap
  lastSwapAt: string = undefined;
  // The swap completion rate of this liquidity
  completionRate: number = undefined;
  // The number of active disputes
  openDisputes: number = undefined;
  // The number of disputes ever created (excluding appeals)
  totalDisputes: number = undefined;
  // The number of swaps
  totalSwaps: number = undefined;
  // The dispute rate of this market
  disputeRate: number = undefined;
  // The satisfactory rate from reviews
  satisfactoryRate: number = undefined;

  /** Not Persisted */
  market: Market;
  totalSwaps24h: string;
  volume24h: string;
  priceChange: number;

  constructor(init?: Partial<Liquidity>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Liquidity;
    object.object = 'liquidity';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'liquidities';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * getByBaseAddress finds a record by base address
   * @param address The base address
   * @param txn Optional transaction object
   */
  static getByBaseAddress(address: string, txn?: Transaction) {
    return this.query(txn).where({ baseAddress: address }).whereNotDeleted().first();
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param mid The market ID
   * @param provider The provider address
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static getLiquidity(
    network: string,
    mid?: string,
    provider?: string,
    select = [],
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .select(...select)
      .whereNotDeleted()
      .where({ network })
      .where((q) => {
        if (mid) q.where('marketId', 'ILIKE', mid);
      })
      .where('provider', 'ILIKE', provider)
      .first();
  }

  /**
   * Update all liquidities belonging to a provider in a given network
   * @param network The network name
   * @param provider The provider address
   * @param upd The update object
   * @param txn Optional transaction object
   */
  static updateProviderLiquidities(
    network: string,
    provider: string,
    upd: Partial<Liquidity>,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network })
      .where('provider', 'ILIKE', provider)
      .patch(upd);
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Liquidity()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat([
            'id',
            'marketId',
            'network',
            'provider',
            'base',
            'baseAddress',
            'quote',
            'quoteAddress',
          ]),
        )
      : ['*'];
    return select;
  }

  /**
   * getLiquidities finds liquidities
   * @param network The network name
   * @param marketId??? The market ID (optional)
   * @param provider??? Filter by provider address (optional)
   * @param maxOpenDisputes??? Allow only records with lower open disputes
   * @param amount Filter by swap amount within min and max swap amount
   * @param country Filter by country
   * @param paymentMethod Filter payment method
   * @param limit??? The number of records to return (optional).
   * @param offset??? The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn??? Optional transaction object
   */
  static search(
    network: string,
    marketId?: string,
    provider?: string,
    maxOpenDisputes?: number,
    amount: string = undefined,
    country: string = undefined,
    paymentMethod: string = undefined,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .select(...select, raw('count(*) over() as' + ' "__queryCount"'))
      .whereNotDeleted()
      .where({ network, paused: false })
      .where('amount', '>', '0');
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    if (maxOpenDisputes) q = q.where('openDisputes', '<', maxOpenDisputes);
    if (amount)
      q = q
        .where(raw(`cast(?? as numeric)`, 'minSwap'), '<=', amount)
        .where(raw(`cast(?? as numeric)`, 'maxSwap'), '>=', amount);
    if (country) q = q.where('country', 'ilike', country);
    if (paymentMethod) q = q.where('paymentMethod', 'ilike', paymentMethod);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q
      .orderBy('amountSwapped', 'DESC')
      .orderBy('totalSwaps', 'DESC')
      .orderBy('completionRate', 'DESC')
      .orderBy('satisfactoryRate', 'DESC');
  }

  /**
   * countLiquidities count liquidities by network and optional provider
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param maxOpenDisputes Allow only records with lower open disputes
   * @param txn Optional transaction object
   */
  static countLiquidities(
    network: string,
    marketId?: string,
    provider?: string,
    maxOpenDisputes?: number,
    txn?: Transaction,
  ): Promise<Liquidity[]> {
    let q = this.query(txn).whereNotDeleted().where({ network, paused: false });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    if (maxOpenDisputes) q = q.where('openDisputes', '<', maxOpenDisputes);
    return q
      .count('id')
      .first()
      .then((res: any) => res.count);
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find all records
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static findAll(q: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity[]> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().then(resolve).catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static count(q: Partial<Liquidity>, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where(q)
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
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).then(resolve).catch(reject);
    });
  }

  /**
   * Count number of non-zero liquidity providers associated with a market
   * @param net The network name
   * @param mid The market ID
   * @param txn Optional transaction object
   * @returns
   */
  static countProvidersInMarket(net: string, mid: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where('marketId', 'ILIKE', mid)
        .where('amount', '>', 0)
        .where({ network: net })
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
   * Get the lowest liquidity price
   * @param net The network name
   * @param mid The market ID
   * @param baseAddress The base address
   * @param withinHours Limit query with now() - n hours
   * @param txn Optional transaction object
   * @returns
   */
  static getLowestPrice(
    net?: string,
    mid?: string,
    baseAddress?: string,
    withinHours?: number,
    txn?: Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) q.where({ network: net });
        })
        .where((q) => {
          if (mid) q.where('marketId', 'ILIKE', mid);
        })
        .where((q) => {
          if (baseAddress) q.where('baseAddress', 'ILIKE', baseAddress);
        })
        .where((q) => {
          if (withinHours) q.where('createdAt', '>', timeAgo);
        })
        .where('amount', '>', 0)
        .orderByRaw('cast(price as numeric) asc')
        .whereNotDeleted()
        .first()
        .then((liq) => {
          if (!liq) return resolve('0');
          return resolve(liq.price);
        })
        .catch(reject);
    });
  }

  /**
   * Get the highest liquidity price
   * @param net The network name
   * @param mid The market ID
   * @param baseAddress The base address
   * @param withinHours Limit query with now() - n hours
   * @param txn Optional transaction object
   * @returns
   */
  static getHighestPrice(
    net: string,
    mid: string,
    baseAddress?: string,
    withinHours?: number,
    txn?: Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) q.where({ network: net });
        })
        .where((q) => {
          if (mid) q.where('marketId', 'ILIKE', mid);
        })
        .where((q) => {
          if (baseAddress) q.where('baseAddress', 'ILIKE', baseAddress);
        })
        .where('amount', '>', 0)
        .where((q) => {
          if (withinHours) q.where('createdAt', '>', timeAgo);
        })
        .orderByRaw('cast(price as numeric) desc')
        .whereNotDeleted()
        .first()
        .then((liq) => {
          if (!liq) return resolve('0');
          return resolve(liq.price);
        })
        .catch(reject);
    });
  }

  /**
   * Get the total amount of liquidity associated with a market
   * @param net The network name
   * @param mid The market ID
   * @param txn Optional transaction object
   * @returns
   */
  static getTotalMarketLiquidity(net: string, mid: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .select(raw('sum(cast(?? as numeric))', 'amount').as('total'))
        .where('marketId', 'ILIKE', mid)
        .where('amount', '>', 0)
        .where({ network: net })
        .whereNotDeleted()
        .then((res: any) => {
          return resolve(res[0].total || '0');
        })
        .catch(reject);
    });
  }

  /**
   * Update records by provider address
   * @param provider The provider address
   * @param udp The update to be applied
   * @param txn Optional transaction object
   */
  static updateByProvider(
    provider: string,
    udp: Partial<Liquidity>,
    txn?: Transaction,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .where('provider', 'ilike', provider)
        .patch(udp)
        .then(resolve)
        .catch(reject);
    });
  }
}

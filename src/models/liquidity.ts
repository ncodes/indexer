import * as crand from 'crypto-random-string';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Market from './market';

/**
 * Liquidity represents a liquidity model
 */
export default class Liquidity extends BaseModel {
  // The network associated with this object
  network: string;
  // The provider address
  provider: string;
  // The market ID
  marketId: string;
  // The liquidity amount
  amount: string;
  // The price of the liquidity
  price: string;
  // The minimum swap amount
  minSwap: string;
  // The maximum swap amount
  maxSwap: string;
  // The time required for taker to make payment
  timeToPay: number;
  // The liquidity manager
  manager: string;

  /** Not Persisted */
  market: Market;

  constructor(init?: Partial<Liquidity>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_' + crand({ length: 24 });
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
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<Liquidity> {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param mid The market ID
   * @param provider The provider address
   * @param txn Optional transaction object
   */
  static getLiquidity(
    network: string,
    mid: string,
    provider?: string,
    txn?: Transaction,
  ): Promise<Liquidity> {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network })
      .where('marketId', 'ILIKE', mid)
      .where('provider', 'ILIKE', provider)
      .first();
  }

  /**
   * getMarketLiquidities returns liquidity associated with a market
   * @param network The network name
   * @param mid The market ID
   * @param provider Filter by provider address (optional)
   * @param txn Optional transaction object
   */
  static getMarketLiquidities(
    network: string,
    mid: string,
    provider?: string,
    txn?: Transaction,
  ): Promise<Liquidity[]> {
    let q = this.query(txn).whereNotDeleted().where({ network }).where('marketId', 'ILIKE', mid);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    return q;
  }

  /**
   * countMarketLiquidities returns count of liquidities associated with
   * a market
   * @param network The network name
   * @param mid The market ID
   * @param provider Filter by provider address (optional)
   * @param txn Optional transaction object
   */
  static countMarketLiquidities(
    network: string,
    mid: string,
    provider?: string,
    txn?: Transaction,
  ): Promise<string> {
    let q = this.query(txn).whereNotDeleted().where({ network }).where('marketId', 'ILIKE', mid);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    return q
      .count('id')
      .first()
      .then((res: any) => res.count);
  }

  /**
   * getLiquidities finds a liquidity by network and optional provider
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param txn Optional transaction object
   */
  static getLiquidities(
    network: string,
    marketId?: string,
    provider?: string,
    limit?: number,
    offset?: number,
    txn?: Transaction,
  ): Promise<Liquidity[]> {
    let q = this.query(txn)
      .select(raw('*, count(*) over() as "__queryCount"'))
      .whereNotDeleted()
      .where({ network });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * countLiquidities count liquidities by network and optional provider
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param txn Optional transaction object
   */
  static countLiquidities(
    network: string,
    marketId?: string,
    provider?: string,
    txn?: Transaction,
  ): Promise<Liquidity[]> {
    let q = this.query(txn).whereNotDeleted().where({ network });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (provider) q = q.where('provider', 'ILIKE', provider);
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
   * Get lowest liquidity price of all liquidity associated with a market
   * @param net The network name
   * @param mid The market ID
   * @param txn Optional transaction object
   * @returns
   */
  static getLowestPriceInMarket(net: string, mid: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where('marketId', 'ILIKE', mid)
        .where({ network: net })
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
   * Get highest liquidity price of all liquidity associated with a market
   * @param net The network name
   * @param mid The market ID
   * @param txn Optional transaction object
   * @returns
   */
  static getHighestPriceInMarket(net: string, mid: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where('marketId', 'ILIKE', mid)
        .where({ network: net })
        .where('amount', '>', 0)
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
}

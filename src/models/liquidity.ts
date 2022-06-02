import * as crand from 'crypto-random-string';
import Objection from 'objection';
import { BaseModel } from './base';

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
  // The number of open orders
  openOrders: number;
  // Indicates whether the liquidity has been paused
  paused: boolean;
  // The block number where the market it was created
  blockNumber: number;
  // The block hash where the market was created
  blockHash: string;

  constructor(init?: Partial<Liquidity>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const liq = super.$formatJson(json) as Liquidity;
    liq.object = 'liquidity';
    return liq;
  }

  static get tableName() {
    return 'liquidities';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create creates a record
   * @param data The transfer info
   */
  static create(data: Partial<Liquidity>): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      return this.query().insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   */
  static getById(id: string): Promise<Liquidity> {
    return this.query().whereNotDeleted().findById(id);
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param mid The market ID
   * @param provider The provider address
   */
  static getLiquidity(
    network: string,
    mid: string,
    provider: string,
  ): Promise<Liquidity> {
    return this.query()
      .whereNotDeleted()
      .where({ network })
      .where('marketId', 'ILIKE', mid)
      .where('provider', 'ILIKE', provider)
      .first();
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param mid The market ID
   * @param provider Filter by provider address (optional)
   */
  static getMarketLiquidities(
    network: string,
    mid: string,
    provider: string,
  ): Promise<Liquidity[]> {
    let q = this.query()
      .whereNotDeleted()
      .where({ network })
      .where('marketId', 'ILIKE', mid);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    return q;
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param provider Filter by provider address (optional)
   */
  static getLiquidities(
    network: string,
    provider: string,
  ): Promise<Liquidity[]> {
    let q = this.query().whereNotDeleted().where({ network });
    if (provider) q = q.where('provider', 'ILIKE', provider);
    return q;
  }

  /**
   * find finds a record
   * @param q the query parameter
   */
  static find(q: Partial<Liquidity>): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      this.query()
        .where(q)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * findAll finds all records
   * @param q the query parameter
   */
  static findAll(q: Partial<Liquidity>): Promise<Liquidity[]> {
    return new Promise((resolve, reject) => {
      this.query().where(q).whereNotDeleted().then(resolve).catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   */
  static count(q: Partial<Liquidity>) {
    return new Promise<string>((resolve, reject) => {
      this.query()
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
   */
  static updateById(id: string, udp: Partial<Liquidity>): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      this.query()
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }
}

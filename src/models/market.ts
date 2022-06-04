import * as crand from 'crypto-random-string';
import Objection, { QueryBuilderType, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Market represents a market model
 */
export default class Market extends BaseModel {
  // The market ID
  mid: string;
  // The creator of the market
  creator: string;
  // The network it exist in
  network: string;
  // The base asset symbol
  base: string;
  // The base asset token address
  baseAddress: string;
  // Indicates whether the base asset represents an off-chain asset
  isBaseLocal: boolean;
  // The quote asset symbol
  quote: string;
  // The quote asset token address
  quoteAddress: string;
  // Indicates whether the quote asset represents an off-chain asset
  isQuoteLocal: boolean;
  // The base/asset pair name
  pair: string;

  // *** Non-persisted fields **//
  mediatorBond: string;
  numOrders: number;
  numDisputes: number;
  permPut: boolean;
  permSwap: boolean;
  permMediate: boolean;
  commission: number;
  numMediators: number;
  baseLogo: string;
  quoteLogo: string;
  numLiquidityProviders: string;
  totalLiquidity: string;
  lowestPrice: string;
  highestPrice: string;

  constructor(init?: Partial<Market>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const market = super.$formatJson(json) as Market;
    market.object = 'market';
    return market;
  }

  static get tableName() {
    return 'markets';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Market>, txn?: Transaction): Promise<Market> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<Market> {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * getByMarketId finds a market by market ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getByMarketId(id: string, txn?: Transaction): Promise<Market> {
    return this.query(txn).whereNotDeleted().where({ mid: id }).first();
  }

  /**
   * getMarket finds a market associated with a network
   * @param network The network name
   * @param marketId The record id
   * @param txn Optional transaction object
   */
  static getMarket(
    network: string,
    marketId: string,
    txn?: Transaction,
  ): Promise<Market> {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network, mid: marketId })
      .first();
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Market>, txn?: Transaction): Promise<Market> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where(q)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Builds a search query to match records across multiple fields.
   * Expects query to contain market ID, base asset name,
   * quote asset name, market pair, base asset address or quote
   * asset address.
   *
   * @param q The query builder
   * @param qs The query string
   * @returns
   */
  static makeSearchQuery(q: QueryBuilderType<any>, qs: string) {
    return q
      .orWhere('mid', qs)
      .orWhere('base', 'ILIKE', qs)
      .orWhere('baseAddress', 'ILIKE', qs)
      .orWhere('quote', 'ILIKE', qs)
      .orWhere('quoteAddress', 'ILIKE', qs)
      .orWhere('pair', 'ILIKE', qs.replaceAll(/\s|\/|\-/gi, ''));
  }

  /**
   * findAll finds all records
   * @param q the query parameter
   */
  static findAll(q: Partial<Market>, txn?: Transaction): Promise<Market[]> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().then(resolve).catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static count(q: Partial<Market>, txn?: Transaction) {
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
  static updateById(
    id: string,
    udp: Partial<Market>,
    txn?: Transaction,
  ): Promise<Market> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }
}

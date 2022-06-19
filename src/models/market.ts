import * as crand from 'crypto-random-string';
import Objection, { Model, QueryBuilderType, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import InvitedMediator from './invited_mediators';
import * as _ from 'lodash';

/**
 * Market represents a market model
 */
export default class Market extends BaseModel {
  // The market ID
  marketId: string;
  // The creator of the market
  creator: string;
  // The network it exists in
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
  // The market's commission
  commission: number;
  // The last time this market had a successfully completed swap
  lastSuccessfulSwapAt: string;
  // The all-time amount of liquidity swapped
  amountSwapped: string;

  // *** Non-persisted fields **//
  mediatorBond: string;
  numOrders: number;
  numDisputes: number;
  permPut: boolean;
  permSwap: boolean;
  permMediate: boolean;
  numMediators: number;
  baseLogo: string;
  quoteLogo: string;
  numProviders: string;
  totalLiquidity: string;
  lowestPrice: string;
  highestPrice: string;
  priceChange: number;
  totalSwaps: string;
  totalInstantSwaps: string;
  totalSwaps24h: string;
  totalInstantSwaps24h: string;
  volume24h: string;
  volumeInstant24h: string;

  static nonPersistedFields = [
    'mediatorBond',
    'numOrders',
    'numDisputes',
    'permPut',
    'permSwap',
    'permMediate',
    'numMediators',
    'baseLogo',
    'quoteLogo',
    'numProviders',
    'totalLiquidity',
    'lowestPrice',
    'highestPrice',
    'priceChange',
    'totalSwaps',
    'totalInstantSwaps',
    'totalSwaps24h',
    'totalInstantSwaps24h',
    'volume24h',
    'volumeInstant24h',
  ];

  constructor(init?: Partial<Market>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Market;
    object.object = 'market';
    return object;
  }

  static get tableName() {
    return 'markets';
  }

  static get relationMappings() {
    return {
      invitedMediators: {
        relation: Model.HasManyRelation,
        modelClass: InvitedMediator,
        join: {
          from: 'markets.marketId',
          to: 'invited_mediators.marketId',
        },
      },
    };
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
    return this.query(txn).whereNotDeleted().where({ marketId: id }).first();
  }

  /**
   * getMarket finds a market associated with a network
   * @param network The network name
   * @param marketId The record id
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static getMarket(
    network: string,
    marketId: string,
    select = [],
    txn?: Transaction,
  ): Promise<Market> {
    select = select.filter((x) => !this.nonPersistedFields.includes(x));
    if (select.length > 0) {
      select.push('id', 'marketId', 'network', 'base', 'baseAddress', 'quote', 'quoteAddress');
      select = _.uniq(select);
    } else {
      select.push('*');
    }

    return this.query(txn)
      .select(...select)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .whereNotDeleted()
      .first();
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Market>, txn?: Transaction): Promise<Market> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
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
      .orWhere('marketId', qs)
      .orWhere('creator', qs)
      .orWhere('base', 'ILIKE', qs)
      .orWhere('baseAddress', 'ILIKE', qs)
      .orWhere('quote', 'ILIKE', qs)
      .orWhere('quoteAddress', 'ILIKE', qs)
      .orWhere('pair', 'ILIKE', qs.replaceAll(/\s|\/|\-/gi, ''))
      .whereNotDeleted();
  }

  /**
   * search for markets
   * @param network The network name (optional)
   * @param creator The market creator address (optional)
   * @param queryStr The query string (optional)
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static searchByCreatorOrQueryString(
    network: string,
    creator: string,
    queryStr: string,
    countOnly: boolean,
    limit: number,
    offset: number,
    select = [],
    txn?: Transaction,
  ): Promise<string | Market[]> {
    select = select.filter((x) => !this.nonPersistedFields.includes(x));
    if (select.length > 0) {
      select.push('id', 'marketId', 'network', 'base', 'baseAddress', 'quote', 'quoteAddress');
      select = _.uniq(select);
    } else {
      select.push('*');
    }

    let query = this.query(txn).select(...select, raw('count(*) over() as' + ' "__queryCount"'));
    if (network) query = query.where('network', network);
    if (creator) query = query.where('creator', 'ilike', creator);
    if (queryStr) query = this.makeSearchQuery(query, queryStr);
    if (countOnly) {
      return query
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * findAll finds all records
   * @param q the query parameter
   * @param txn The transaction object
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
  static updateById(id: string, udp: Partial<Market>, txn?: Transaction): Promise<Market> {
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

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
  marketId: string = undefined;
  // The creator of the market
  creator: string = undefined;
  // The network it exists in
  network: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset token address
  baseAddress: string = undefined;
  // Indicates whether the base asset represents an off-chain asset
  isBaseLocal: boolean = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset token address
  quoteAddress: string = undefined;
  // Indicates whether the quote asset represents an off-chain asset
  isQuoteLocal: boolean = undefined;
  // The base/asset pair name
  pair: string = undefined;
  // The market's commission
  commission: number = undefined;
  // The last time this market had a successfully completed swap
  lastSuccessfulSwapAt: string = undefined;
  // The all-time amount of liquidity swapped
  amountSwapped: string = undefined;
  // The swap completion/release rate of this market
  completionRate: number = undefined;
  // The transaction hash
  txHash: string = undefined;
  // The minimum number of mediators required in a dispute
  numMediators: number = undefined;
  // The number of mediators joined
  numMediatorsJoined: number = undefined;
  // The total bond of joined mediators
  totalJoinedMediatorsBond: string = undefined;
  // The number of active disputes
  openDisputes: number = undefined;
  // The number of disputes ever created (excluding appeals)
  totalDisputes: number = undefined;
  // The number of swaps
  totalSwaps: number = undefined;
  // The dispute rate of this market
  disputeRate: number = undefined;
  // Indicates the liquidity providers are permissioned
  permPut: boolean = undefined;
  // Indicates the swap operation is permissioned
  permSwap: boolean = undefined;
  // Indicates the mediation operation is permissioned
  permMediate: boolean = undefined;
  // The minimum mediator bond
  mediatorBond: string = undefined;

  // *** Non-persisted fields **//
  numDisputes: number; // (include appeals)
  baseLogo: string;
  quoteLogo: string;
  numProviders: string;
  totalLiquidity: string;
  lowestPrice: string;
  lowestPrice24h: string;
  highestPrice24h: string;
  priceChange: number;
  totalSwaps24h: string;
  volume24h: string;

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
   * Checks if the market is an instant swap market
   */
  isInstant() {
    return !this.isBaseLocal && !this.isQuoteLocal;
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

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Market()).includes(x));
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
          ]),
        )
      : ['*'];
    return select;
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
    select = this.makeSelectList(select);
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
      .orWhere('creator', 'ILIKE', `%${qs}%`)
      .orWhere('base', 'ILIKE', `%${qs}%`)
      .orWhere('baseAddress', 'ILIKE', qs)
      .orWhere('quote', 'ILIKE', `%${qs}%`)
      .orWhere('quoteAddress', 'ILIKE', `%${qs}%`)
      .orWhere('pair', 'ILIKE', `%${qs.replaceAll(/\s|\/|-/gi, '')}%`)
      .whereNotDeleted();
  }

  /**
   * search for markets
   * @param network The network name (optional)
   * @param creator The market creator address (optional)
   * @param baseAsset The base asset address (optional)
   * @param quoteAsset The quote asset address (optional)
   * @param queryStr The query string (optional)
   * @param noPermSwap Indicate to ignore market with permissioned swap enabled (optional)
   * @param onlyPermMediate Indicate to include only market with permissioned mediation enabled (optional)
   * @param onlyInstant Indicate to include only market where base and quote asset are on-chain.
   * @param minMediatorBond Indicate to only return market with a specific minimum mediator bond (optional)
   * @param minJoinedMediators Indicate to only return market with a specific minimum number of joined mediators (optional)
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields (optional)
   * @param txn??????? Optional transaction object
   */
  static search(
    network: string,
    creator: string,
    baseAsset: string,
    quoteAsset: string,
    queryStr: string,
    noPermSwap: boolean = false,
    onlyPermMediate: boolean = false,
    onlyInstant: boolean = undefined,
    minMediatorBond: string = undefined,
    minJoinedMediators: number = undefined,
    countOnly: boolean,
    limit: number,
    offset: number,
    select = [],
    txn?: Objection.Transaction,
  ): Promise<string | Market[]> {
    select = this.makeSelectList(select);
    let query = this.query(txn).select(...select, raw('count(*) over() as' + ' "__queryCount"'));
    if (network) query = query.where('network', 'ilike', network);
    if (creator) query = query.where('creator', 'ilike', creator);
    if (baseAsset) query = query.where('baseAddress', 'ilike', baseAsset);
    if (quoteAsset) query = query.where('quoteAddress', 'ilike', quoteAsset);
    if (noPermSwap) query = query.where('permSwap', false);
    if (onlyPermMediate) query = query.where('permMediate', true);
    if (onlyInstant !== undefined) {
      if (onlyInstant) {
        query = query.where('isBaseLocal', true).andWhere('isQuoteLocal', true);
      } else {
        query = query.where((q) => {
          q.orWhere('isBaseLocal', true)
            .andWhere('isQuoteLocal', false)
            .orWhere('isBaseLocal', false)
            .andWhere('isQuoteLocal', true);
        });
      }
    }
    if (minMediatorBond)
      query = query.where(raw(`cast(?? as numeric)`, 'mediatorBond'), '>=', minMediatorBond);
    if (minJoinedMediators) query = query.where('numMediatorsJoined', '>=', minJoinedMediators);
    if (queryStr)
      query = query.where((q) => {
        this.makeSearchQuery(q, queryStr);
      });
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
    return query
      .whereNotDeleted()
      .orderBy('totalSwaps', 'DESC') // prefer high swap transactions
      .orderBy('amountSwapped', 'DESC') // prefer high volume
      .orderBy('completionRate', 'DESC') // prefer high release rate (without dispute)
      .orderBy('totalJoinedMediatorsBond', 'DESC') // prefer high mediator bond
      .orderBy('numMediatorsJoined', 'DESC'); // prefer high number of mediators
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

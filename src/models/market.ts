import { randStr } from '../common/common';
import Objection, { QueryBuilderType, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import * as _ from 'lodash';

export enum AssetType {
  SYNTH,
  ERC20,
  ERC721,
  ERC1155,
}

export interface Asset {
  asset: string;
  type: AssetType;
}

/**
 * Market represents a market model
 */
export default class Market extends BaseModel {
  // The market address
  address: string = undefined;
  // The creator of the market
  creator: string = undefined;
  // The network it exists in
  network: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset token address
  baseAddress: string = undefined;
  // Indicates the type of the base asset
  baseType: AssetType = undefined;
  // The base asset decimals (if applicable)
  baseDecimals: number = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset token address
  quoteAddress: string = undefined;
  // The quote asset decimals (if applicable)
  quoteDecimals: number;
  // Indicates the type of quote asset
  quoteType: AssetType = undefined;
  // Indicates whether this is an instant market
  instant: boolean = undefined;
  // Indicates that liquidities can have zero price
  allowZeroPrice: boolean = undefined;
  // Indicates that all liquidity can be accessed only via offer
  offerOnly: boolean = undefined;
  // The base/asset pair name
  pair: string = undefined;
  // The market's commission
  commission: number = undefined;
  // The last time this market had a successfully completed swap
  lastSwapAt: string = undefined;
  // The all-time amount of liquidity swapped
  amountSwapped: string = undefined;
  // The swap completion/release rate of this market
  completionRate: number = undefined;
  // The transaction hash
  txHash: string = undefined;
  // The mediator pool ID
  mediatorPoolId: number = undefined;
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
  // Number of seconds before dispute can be started
  disputeDelayTime: number = undefined;
  // Number of seconds within which evidence must be shared
  evidenceDur: number = undefined;
  // Number of seconds for votes to be committed and revealed
  predictDur: number = undefined;
  // The market manager
  manager: string = undefined;
  // Total liquidity in this market
  totalLiquidity: string = undefined;
  // The list of required badges to put liquidity
  requiredPutBadges: string[] = undefined;
  // The list of required badges to swap
  requiredSwapBadges: string[] = undefined;
  // The average number of seconds within which swaps are finalized
  avgFinalizeDur: number = undefined;
  // The average number of seconds within which swaps are marked as paid
  avgPaymentDur: number = undefined;
  // The average number of seconds within which swaps are marked as released
  avgReleaseDur: number = undefined;
  // The lowest price in the market
  lowestPrice: string = undefined;

  // *** Non-persisted fields **//
  numDisputes: number;
  baseLogo: string;
  quoteLogo: string;
  numProviders: string;
  lowestPriceUsd: number;
  lowestPrice24h: string;
  highestPrice24h: string;
  priceChange: number;
  totalSwaps24h: string;
  volume24h: string;
  amountSwappedUsd: number;
  totalLiquidityUsd: number;
  volume24hUsd: number;

  constructor(init?: Partial<Market>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_' + randStr(24);
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
    this.requiredPutBadges = this.requiredPutBadges
      ? (JSON.stringify(this.requiredPutBadges) as any)
      : this.requiredPutBadges;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
    this.requiredPutBadges = this.requiredPutBadges
      ? (JSON.stringify(this.requiredPutBadges) as any)
      : this.requiredPutBadges;
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
    return {};
  }

  getBaseAsset(): Asset {
    return {
      asset: this.base,
      type: this.baseType,
    };
  }

  getQuoteAsset(): Asset {
    return {
      asset: this.quote,
      type: this.quoteType,
    };
  }

  static isOnchain(assetType: AssetType) {
    return this.isERC20(assetType) || this.isNFT(assetType);
  }

  /**
   * Checks if the market is an instant swap market
   */
  isInstant() {
    const { baseType, quoteType } = this;
    return Market.isInstant(baseType, quoteType);
  }

  isFungible() {
    return (
      (Market.isERC20(this.baseType) || Market.isSynth(this.baseType)) &&
      (Market.isERC20(this.quoteType) || Market.isSynth(this.quoteType))
    );
  }

  hasERC20() {
    return Market.isERC20(this.baseType) || Market.isERC20(this.quoteType);
  }

  isBaseSynth() {
    return Market.isSynth(this.baseType);
  }

  isQuoteSynth() {
    return Market.isSynth(this.quoteType);
  }

  isBase(t: AssetType) {
    return this.baseType == t;
  }

  isQuote(t: AssetType) {
    return this.quoteType == t;
  }

  static isERC20(assetType: AssetType) {
    return assetType == AssetType.ERC20;
  }

  static isERC721(assetType: AssetType) {
    return assetType == AssetType.ERC721;
  }

  static isERC1155(assetType: AssetType) {
    return assetType == AssetType.ERC1155;
  }

  static isSynth(assetType: AssetType) {
    return assetType == AssetType.SYNTH;
  }

  static isFungible(assetType: AssetType) {
    return assetType == AssetType.ERC20 || assetType == AssetType.SYNTH;
  }

  static isNFT(assetType: AssetType) {
    return assetType == AssetType.ERC721 || assetType == AssetType.ERC1155;
  }

  /**
   * Check if an asset pair type represents an instant market
   * @param baseType The base asset type
   * @param quoteType The quote asset type
   */
  static isInstant(baseType: AssetType, quoteType: AssetType) {
    const baseIsNFT = baseType == AssetType.ERC721 || baseType == AssetType.ERC1155;
    const quoteIsNFT = quoteType == AssetType.ERC721 || quoteType == AssetType.ERC1155;
    return (
      (baseType == AssetType.ERC20 && quoteType == AssetType.ERC20) ||
      (baseType == AssetType.ERC20 && quoteIsNFT) ||
      (baseIsNFT && quoteType == AssetType.ERC20) ||
      (baseIsNFT && quoteIsNFT)
    );
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Market>, txn?: Transaction): Promise<Market> {
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
   * getByAddress finds a market by its address
   * @param address The address of the market
   * @param txn Optional transaction object
   */
  static getByAddress(address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('address', address).first();
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Market()).includes(x));
    select = select.length
      ? _.uniq(select.concat(['id', 'address', 'network', 'base', 'baseAddress', 'quote', 'quoteAddress']))
      : ['*'];
    return select;
  }

  /**
   * getMarket finds a market associated with a network
   * @param network The network name
   * @param marketAddress The record id
   * @param select Select specific fields (optional)
   * @param relations Indicate the relations to fetch
   * @param txn? Optional transaction object
   */
  static getMarket(
    network: string,
    marketAddress: string,
    select = [],
    relations: string = undefined,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .select(...select)
      .where('network', 'ilike', network)
      .where('address', 'ilike', marketAddress)
      .whereNotDeleted()
      .withGraphFetched(relations)
      .first();
  }

  /**
   * find a record
   * @param q The query parameter
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
      .orWhere('address', qs)
      .orWhere('creator', 'ILIKE', `%${qs}%`)
      .orWhere('base', 'ILIKE', `%${qs}%`)
      .orWhere('baseAddress', 'ILIKE', qs)
      .orWhere('quote', 'ILIKE', `%${qs}%`)
      .orWhere('quoteAddress', 'ILIKE', `%${qs}%`)
      .orWhere('pair', 'ILIKE', `%${qs.replaceAll(/\s|\/|-/gi, '')}%`)
      .whereNotDeleted();
  }

  /**
   * Search for markets (all fields are optional)
   * @param network The network name
   * @param creator The market creator address
   * @param baseAsset The base asset address
   * @param quoteAsset The quote asset address
   * @param queryStr The query string
   * @param price Filter by price (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param availableLiquidity Filter by available liquidity (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param reqPutBadges A list of PUT badges to filter by
   * @param permSwap Indicate to ignore market with permissioned swap enabled
   * @param instant Indicate to include only market where base and quote asset are on-chain.
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param relations The relationships to fetch
   * @param txn? Optional transaction object
   */
  static search(
    network: string,
    creator: string,
    baseAsset: string,
    quoteAsset: string,
    queryStr: string,
    price: string,
    availableLiquidity: string,
    reqPutBadges: string[],
    permSwap: boolean,
    instant: boolean,
    countOnly: boolean,
    limit: number,
    offset: number,
    select = [],
    relations: string = undefined,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let query = this.query(txn);
    query = !countOnly ? query.select(...select, raw('count(*) over() as' + ' "$queryCount"')) : query;
    if (network) query = query.where('network', 'ilike', network);
    if (creator) query = query.where('creator', 'ilike', creator);
    if (baseAsset) query = query.where('baseAddress', 'ilike', baseAsset);
    if (quoteAsset) query = query.where('quoteAddress', 'ilike', quoteAsset);
    if (permSwap !== undefined) query = query.where('permSwap', permSwap);
    if (instant !== undefined) query = query.where('instant', instant);
    if (queryStr) {
      query = query.where((q) => {
        this.makeSearchQuery(q, queryStr);
      });
    }
    if (price) {
      const operator = price.startsWith('>') ? '>=' : '<=';
      const priceValue = price.replace('>', '').replace('<', '');
      query = query.where(raw('"lowestPrice"'), operator, priceValue);
    }
    if (availableLiquidity) {
      const operator = availableLiquidity.startsWith('>') ? '>=' : '<=';
      const availableLiquidityValue = availableLiquidity.replace('>', '').replace('<', '');
      query = query.where(raw('"totalLiquidity"'), operator, availableLiquidityValue);
    }
    if (!_.isEmpty(reqPutBadges)) {
      query = query.whereRaw(
        `EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text("requiredPutBadges") badge
      WHERE badge ILIKE ANY (?::text[])
      )`,
        [reqPutBadges],
      );
    }
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
      .orderBy('amountSwapped', 'DESC') // prefer high volume
      .orderBy('totalSwaps', 'DESC') // prefer high swap transactions
      .orderBy('completionRate', 'DESC') // prefer high release rate (without dispute)
      .withGraphFetched(relations);
  }

  /**
   * count returns the count of record matching q
   * @param q The query parameter
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
   * @param id The record id
   * @param udp The fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Market>, txn?: Transaction): Promise<Market> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * updateByMarketAddress updates a record by market address
   * @param network The target network
   * @param address The market address
   * @param udp The fields to be updated
   * @param txn Optional transaction object
   */
  static updateByNetworkAddress(
    network: string,
    address: string,
    udp: Partial<Market>,
    txn?: Transaction,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where({ network })
        .where('address', 'ilike', address)
        .whereNotDeleted()
        .patch(udp)
        .then(resolve)
        .catch(reject);
    });
  }
}

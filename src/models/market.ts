import { ChainNames } from '@jointlabs/meta';
import * as _ from 'lodash';
import Objection, { QueryBuilderType, raw, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

export enum AssetType {
  SYNTH,
  ERC20,
  ERC721,
  ERC1155,
  NATIVE,
}

export interface Asset {
  asset: string;
  type: AssetType;
}

interface MarketSearchParams {
  network?: string;
  creator?: string;
  address?: string[];
  base?: string;
  quote?: string;
  queryStr?: string;
  price?: string;
  liquidity?: string;
  baseUsdRate?: number;
  quoteUsdRate?: number;
  priceUsd?: string;
  liquidityUsd?: string;
  regions?: string[];
  reqPutBadges?: string[];
  reqSwapBadges?: string[];
  offer?: boolean;
  permSwap?: boolean;
  permPut?: boolean;
  instant?: boolean;
  hidden?: boolean;
  countOnly?: boolean;
  limit?: number;
  offset?: number;
  select?: any[];
  relations?: string;
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
  network: ChainNames = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset token address
  baseAddress: string = undefined;
  // Indicates the type of the base asset
  baseType: AssetType = undefined;
  // The base asset decimals (if applicable)
  baseDecimals: number = undefined;
  // The base asset logo URL
  baseLogo: string = undefined;
  // The base asset price in USD
  basePriceUsd: string = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset token address
  quoteAddress: string = undefined;
  // The quote asset decimals (if applicable)
  quoteDecimals: number;
  // Indicates the type of quote asset
  quoteType: AssetType = undefined;
  // The quote asset logo URL
  quoteLogo: string = undefined;
  // The quote asset price in USD
  quotePriceUsd: string = undefined;
  // Indicates whether this is an instant market
  instant: boolean = undefined;
  // Indicates that offers can have zero price
  enabledZeroOfferPrice: boolean = undefined;
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
  // Indicates the liquidity providers are permissioned or not
  permPut: boolean = undefined;
  // Indicates the swap operation is permissioned or not
  permSwap: boolean = undefined;
  // Indicates the market creator renounced ownership
  renounced: boolean;
  // Number of seconds before dispute can be started
  disputeDelayDur: number = undefined;
  // The market manager
  manager: string = undefined;
  // The region badge attached to this market
  regions: string[] = undefined;
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
  // Indicates the market is hidden
  hidden: boolean;
  // The last time the metadata was updated
  lastMetaUpdatedAt: string = undefined;

  // *** Non-persisted fields **//
  totalLiquidity: string = undefined;
  evidenceDur: number = undefined;
  predictDur: number = undefined;
  lowestPriceUsd: number;
  totalLiquidityUsd: number = undefined;
  numDisputes: number;
  numProviders: string;
  lowestPrice24h: string;
  highestPrice24h: string;
  priceChange: number;
  totalSwaps24h: string;
  volume24h: string;
  amountSwappedUsd: number;

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
    this.regions = this.regions ? (JSON.stringify(this.regions) as any) : this.regions;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
    this.requiredPutBadges = this.requiredPutBadges
      ? (JSON.stringify(this.requiredPutBadges) as any)
      : this.requiredPutBadges;
    this.regions = this.regions ? (JSON.stringify(this.regions) as any) : this.regions;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Market;
    object.object = 'market';
    delete (object as any).total_liquidity;
    return object;
  }

  static get tableName() {
    return 'markets';
  }

  static get relationMappings() {
    return {};
  }

  static isNative(assetType: AssetType) {
    return assetType == AssetType.NATIVE;
  }

  static isERC20(assetType: AssetType) {
    return assetType == AssetType.ERC20;
  }

  static isERC721(assetType: AssetType) {
    return assetType == AssetType.ERC721;
  }

  static isSynth(assetType: AssetType) {
    return assetType == AssetType.SYNTH;
  }

  static isFungible(assetType: AssetType) {
    return assetType == AssetType.ERC20 || assetType == AssetType.SYNTH || assetType == AssetType.NATIVE;
  }

  static isNFT(assetType: AssetType) {
    return assetType == AssetType.ERC721 || assetType == AssetType.ERC1155;
  }

  static isOnchain(assetType: AssetType) {
    return Market.isERC20(assetType) || Market.isNFT(assetType) || Market.isNative(assetType);
  }

  isInstant() {
    const { baseType, quoteType } = this;
    return Market.isInstant(baseType, quoteType);
  }

  isFungible() {
    return Market.isFungible(this.baseType) && Market.isFungible(this.quoteType);
  }

  involvesERC20() {
    return Market.isERC20(this.baseType) || Market.isERC20(this.quoteType);
  }

  involvesERC20OrNative() {
    return (
      Market.isERC20(this.baseType) ||
      Market.isNative(this.baseType) ||
      Market.isERC20(this.quoteType) ||
      Market.isNative(this.quoteType)
    );
  }

  /**
   * Check if an asset pair type represents an instant market
   * @param baseType The base asset type
   * @param quoteType The quote asset type
   */
  static isInstant(baseType: AssetType, quoteType: AssetType) {
    return (
      (Market.isERC20(baseType) && Market.isERC20(quoteType)) || // ERC20/ERC20
      (Market.isERC20(baseType) && Market.isNFT(quoteType)) || // ERC20/NFT
      (Market.isERC20(baseType) && Market.isNative(quoteType)) || // ERC20/NATIVE
      (Market.isNFT(baseType) && Market.isERC20(quoteType)) || // NFT/ERC20
      (Market.isNFT(baseType) && Market.isNFT(quoteType)) || // NFT/NFT
      (Market.isNFT(baseType) && Market.isNative(quoteType)) || // NFT/NATIVE
      (Market.isNative(baseType) && Market.isNative(quoteType)) || // NATIVE/NATIVE
      (Market.isNative(baseType) && Market.isERC20(quoteType)) || // NATIVE/ERC20
      (Market.isNative(baseType) && Market.isNFT(quoteType)) // NATIVE/NFT
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
   * @param noJoins If set, it will not join the related tables or create derived fields
   * @param txn Optional transaction object
   */
  static getById(id: string, noJoins?: boolean, txn?: Transaction) {
    return this.buildMarketsQuery({ noJoins }, txn).whereNotDeleted().findById(id);
  }

  /**
   * getByAddress finds a market by its address
   * @param address The address of the market
   * @param txn Optional transaction object
   */
  static getByAddress(address: string, txn?: Transaction) {
    return this.buildMarketsQuery({}, txn).whereNotDeleted().where('address', address).first();
  }

  /**
   * Make a select list
   * @param select The fields to select
   * @param prefix The prefix to add to the fields
   * @returns
   */
  static makeSelectList(select = [], prefix = '') {
    select = select.filter((x) => Object.keys(new Market()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat([
            'id',
            'address',
            'network',
            'base',
            'baseAddress',
            'quote',
            'quoteAddress',
            'createdAt',
            'updatedAt',
            'deletedAt',
          ]),
        )
      : ['*'];

    select = select.map((s) => {
      return prefix ? `${prefix}.${s}` : s;
    });

    return select;
  }

  /**
   * getMarket finds a market associated with a network
   * @param network The network name
   * @param marketAddress The record id
   * @param select Select specific fields (optional)
   * @param relations Indicate the relations to fetch
   * @param noJoins If set, it will not join the related tables or create derived fields
   * @param txn Optional transaction object
   */
  static getMarket(
    network: string,
    marketAddress: string,
    select = [],
    relations: string = undefined,
    noJoins = false,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    return this.buildMarketsQuery({ select, noJoins }, txn)
      .where('network', 'ilike', network)
      .where('address', 'ilike', marketAddress)
      .whereNotDeleted()
      .withGraphFetched(relations)
      .first();
  }

  /**
   * getMarketByBaseAndQuote finds a market by its base and quote addresses
   * @param network The network name
   * @param baseAddress The base asset address
   * @param quoteAddress The quote asset address
   * @param creator The market creator address
   * @param baseType The base asset type
   * @param quoteType The quote asset type
   * @param select Select specific fields (optional)
   * @param relations Indicate the relations to fetch
   * @param noJoins If set, it will not join the related tables or create derived fields
   * @param txn Optional transaction object
   */
  static getMarketByBaseAndQuote(
    network: string,
    baseAddress: string,
    quoteAddress: string,
    creator?: string,
    baseType?: AssetType,
    quoteType?: AssetType,
    select = [],
    relations: string = undefined,
    noJoins = false,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    return this.buildMarketsQuery({ select, noJoins, creator, baseType, quoteType }, txn)
      .where('network', 'ilike', network)
      .where('baseAddress', 'ilike', baseAddress)
      .where('quoteAddress', 'ilike', quoteAddress)
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
      this.buildMarketsQuery({}, txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
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
      .orWhere('pair', 'ILIKE', `%${qs.replaceAll(/\s|\/|-/gi, '')}%`);
  }

  /**
   * Create markets query builder. The base for all markets query.
   * @param select The fields to select
   * @param baseUsdRate The USD rate used for base USD conversions
   * @param quoteUsdRate The USD rate used for quote USD conversions
   * @param creator The market creator address
   * @param baseType The base asset type
   * @param quoteType The quote asset type
   * @param noJoins If set, it will not join the related tables or create derived fields
   * @param txn Optional transaction object
   * @returns
   */
  static buildMarketsQuery(
    {
      select,
      baseUsdRate,
      quoteUsdRate,
      creator,
      baseType,
      quoteType,
      noJoins,
    }: {
      select?: string[];
      baseUsdRate?: number;
      quoteUsdRate?: number;
      creator?: string;
      baseType?: AssetType;
      quoteType?: AssetType;
      noJoins?: boolean;
    },
    txn?: Objection.Transaction,
  ) {
    let sub = this.query(txn);
    select = select ?? [];

    // Get markets and any derived fields
    if (!noJoins) {
      sub = sub
        .select('markets.*', raw('COALESCE(SUM(liquidities.amount), 0) AS "totalLiquidity"'))
        .groupBy('markets.sn', 'markets.id')
        .leftJoin('liquidities', (join) => {
          join.on('markets.address', 'liquidities.marketAddress');
          join.andOn('markets.network', 'liquidities.network');
        });
    }

    // Subclass the markets query to perform further queries against it
    let sub2 = this.query()
      .select(...select)
      .from(sub.as('sub'));

    if (!noJoins) {
      if (baseUsdRate)
        sub2 = sub2.select(
          raw('"totalLiquidity" * ?? / POW(10, "baseDecimals") as "totalLiquidityUsd"', [baseUsdRate]),
        );
      if (quoteUsdRate)
        sub2 = sub2.select(raw('"lowestPrice" * ?? / POW(10,"quoteDecimals") as "lowestPriceUsd"', [quoteUsdRate]));
    }

    let q = this.query().from(sub2.as('markets'));

    if (creator) q = q.where('creator', 'ILIKE', creator);

    if (baseType) q = q.where('baseType', baseType);
    if (quoteType) q = q.where('quoteType', quoteType);

    return q;
  }

  /**
   * Search for markets (all fields are optional)
   * @param network The network name
   * @param creator The market creator address
   * @param address The market addresses to filter by
   * @param base The base asset address or symbol
   * @param quote The quote asset address or symbol
   * @param queryStr The query string
   * @param price Filter by price (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param priceUsd Filter by USD price (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param liquidity Filter by available liquidity (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param baseUsdRate The USD rate used for base USD conversions
   * @param quoteUsdRate The USD rate used for quote USD conversions
   * @param liquidityUsd Filter by USD available liquidity (if it starts with >, it means equal or greater than, if it starts with <, it means equal or less than)
   * @param regions A list of regions to filter by
   * @param reqPutBadges A list of PUT badges to filter by
   * @param reqSwapBadges A list of SWAP badges to filter by
   * @param offer Indicate to filter by offer type
   * @param permSwap If set, markets are filtered by whether they are permissioned for swap or not
   * @param permPut  If set, markets are filtered by whether they are permissioned for put or not
   * @param instant Indicate to include only market where base and quote asset are on-chain.
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param relations The relationships to fetch
   * @param txn Optional transaction object
   */
  static async search(
    {
      network,
      creator,
      address,
      base,
      quote,
      queryStr,
      price,
      liquidity,
      baseUsdRate = 0,
      quoteUsdRate = 0,
      priceUsd,
      liquidityUsd,
      regions,
      reqPutBadges,
      reqSwapBadges,
      offer,
      permSwap,
      permPut,
      instant,
      countOnly,
      limit,
      offset,
      hidden,
      select = [],
      relations = undefined,
    }: MarketSearchParams,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select, '');

    // Final subclass: derived calculations are ready
    let q2 = this.buildMarketsQuery({ select, baseUsdRate, quoteUsdRate }, txn);

    if (base) {
      q2 = q2.where((q) => {
        return q.where('baseAddress', 'ILIKE', base).orWhere('base', 'ILIKE', base);
      });
    }

    if (quote) {
      q2 = q2.where((q) => {
        return q.where('quoteAddress', 'ILIKE', quote).orWhere('quote', 'ILIKE', quote);
      });
    }

    // Calculate the total liquidity with a subquery on liquidity table
    q2 = q2.whereNotDeleted();

    // q2 = !countOnly ? q2.select(...select, raw('count(*) over() as' + ' "$queryCount"')) : q;

    if (network) q2 = q2.where('network', 'ilike', network);

    if (creator) q2 = q2.where('creator', 'ilike', creator);

    if (address) q2 = q2.where('address', 'in', address);

    if (permSwap !== undefined) q2 = q2.where('permSwap', permSwap);

    if (permPut !== undefined) q2 = q2.where('permPut', permPut);

    if (instant !== undefined) q2 = q2.where('instant', instant);

    if (queryStr) {
      q2 = q2.where((q) => {
        return this.makeSearchQuery(q, queryStr);
      });
    }

    if (price) {
      const operator = price.startsWith('>') ? '>=' : '<=';
      const priceValue = price.replace('>', '').replace('<', '');
      q2 = q2.where(raw('"lowestPrice"'), operator, priceValue);
    }

    if (priceUsd) {
      const operator = priceUsd.startsWith('>') ? '>=' : '<=';
      const priceValue = priceUsd.replace('>', '').replace('<', '');
      q2 = q2.where(raw('"lowestPriceUsd"'), operator, priceValue);
    }

    if (liquidity) {
      const operator = liquidity.startsWith('>') ? '>=' : '<=';
      const availableLiquidityValue = liquidity.replace('>', '').replace('<', '');
      q2 = q2.where(raw('"totalLiquidity"'), operator, availableLiquidityValue);
    }

    if (liquidityUsd) {
      const operator = liquidityUsd.startsWith('>') ? '>=' : '<=';
      const availableLiquidityValue = liquidityUsd.replace('>', '').replace('<', '');
      q2 = q2.where(raw('"totalLiquidityUsd"'), operator, availableLiquidityValue);
    }

    if (regions && regions.length) {
      q2 = q2.whereRaw(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text("regions") region
          WHERE region ILIKE ANY (?::text[])
        )`,
        [regions],
      );
    }

    if (!_.isEmpty(reqPutBadges)) {
      q2 = q2.whereRaw(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text("requiredPutBadges") badge
          WHERE badge ILIKE ANY (?::text[])
        )`,
        [reqPutBadges],
      );
    }

    if (!_.isEmpty(reqSwapBadges)) {
      q2 = q2.whereRaw(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text("requiredSwapBadges") badge
          WHERE badge ILIKE ANY (?::text[])
        )`,
        [reqSwapBadges],
      );
    }

    if (offer !== undefined) {
      q2 = q2.where('offerOnly', offer);
    }

    if (hidden != undefined) {
      q2 = q2.where({ hidden });
    }

    if (countOnly) {
      return (await q2.count('id').first()).count;
    }

    if (offset != undefined) q2 = q2.offset(offset);

    if (limit) q2 = q2.limit(limit);

    q2 = q2
      .orderBy('avgFinalizeDur', 'ASC') // prefer low finalize duration
      .orderBy('avgPaymentDur', 'ASC') // prefer low payment duration
      .orderBy('avgReleaseDur', 'ASC') // prefer low release duration
      .orderBy('amountSwapped', 'DESC') // prefer high volume
      .orderBy('totalSwaps', 'DESC') // prefer high swap transactions
      .orderBy('completionRate', 'DESC') // prefer high release rate (without dispute)
      .orderBy('updatedAt', 'DESC')
      .orderBy('sn', 'DESC')
      .withGraphFetched(relations);

    return q2;
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

  /**
   * Find markets whose meta has not been updated since a given period
   * @param periodAt The last time the meta was updated
   * @param limit The number of records to return
   * @param txn
   * @returns
   */
  static async findMarketsToUpdateMeta(periodAt: string, limit: number, txn?: Transaction) {
    return this.query(txn)
      .where((q) => {
        q.where('lastMetaUpdatedAt', '<', periodAt).orWhereNull('lastMetaUpdatedAt');
      })
      .whereNotDeleted()
      .orderBy('lastSwapAt', 'DESC')
      .limit(limit);
  }
}

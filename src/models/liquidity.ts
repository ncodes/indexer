import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Market, { AssetType } from './market';
import * as _ from 'lodash';
import * as moment from 'moment';

/**
 * Liquidity represents a liquidity model
 */
export default class Liquidity extends BaseModel {
  // The network associated with this object
  network: string = undefined;
  // The provider address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
  // The market address
  marketAddress: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // Indicates the type of the base asset
  baseType: AssetType = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // Indicates the type of quote asset
  quoteType: AssetType = undefined;
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
  // The specific address allowed to swap the liquidity
  target: string = undefined;
  // The NFT IDs that make up the liquidity
  ids: number[] = undefined;
  // A list of NFT IDs of which the liquidity provider wants at least one
  // in return for the liquidity
  wantOrIds: number[] = undefined;
  // A list of NFT IDs of which the liquidity provider wants all
  // in return for the liquidity
  wantAndIds: number[] = undefined;
  // The time required for taker to make payment
  timeToPay: number = undefined;
  // The liquidity manager
  manager: string = undefined;
  // Indicates that the liquidity has been paused
  paused: boolean = undefined;
  // Indicates that the swapping has been disabled for the liquidity
  swapDisabled: boolean = undefined;
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
  // The list of required badges to swap
  requiredSwapBadges: string[] = undefined;
  // The average number of seconds within which swaps are finalized
  avgFinalizeDur: number;
  // The average number of seconds within which swaps are marked as paid
  avgPaymentDur: number;
  // The average number of seconds within which swaps are marked as released
  avgReleaseDur: number;

  /** Not Persisted */
  totalSwaps24h: string;
  volume24h: string;
  priceChange: number;
  priceUsd: number;

  /** Relations */
  market: Market;

  constructor(init?: Partial<Liquidity>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_' + randStr(24);
    this.ids = this.ids ? (JSON.stringify(this.ids) as any) : this.ids;
    this.wantOrIds = this.wantOrIds ? (JSON.stringify(this.wantOrIds) as any) : this.wantOrIds;
    this.wantAndIds = this.wantAndIds ? (JSON.stringify(this.wantAndIds) as any) : this.wantAndIds;
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.ids = JSON.stringify(this.ids) as any;
    this.wantOrIds = JSON.stringify(this.wantOrIds) as any;
    this.wantAndIds = JSON.stringify(this.wantAndIds) as any;
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
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
   * getById finds a record by ID
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
   * @param lid The liquidity ID
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static getLiquidity(network: string, mid?: string, provider?: string, lid?: number, select = [], txn?: Transaction) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .select(...select)
      .whereNotDeleted()
      .where({ network })
      .where((q) => {
        if (mid) q = q.where('marketAddress', 'ILIKE', mid);
        if (provider) q = q.where('provider', 'ILIKE', provider);
        if (!_.isNil(lid)) q = q.where('lid', lid);
        return q;
      })
      .first();
  }

  /**
   * Update all liquidities belonging to a provider in a given network and market
   * @param network The network name
   * @param marketAddress The market address
   * @param provider The provider address
   * @param lid The liquidity ID (optional)
   * @param upd The update object
   * @param txn? Optional transaction object
   */
  static update(
    network: string,
    marketAddress: string,
    provider: string,
    lid: number = undefined,
    upd: Partial<Liquidity>,
    txn?: Objection.Transaction,
  ) {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network })
      .where('marketAddress', 'ILIKE', marketAddress)
      .where('provider', 'ILIKE', provider)
      .where((q) => {
        if (lid != undefined) return q.where('lid', lid);
      })
      .patch(upd);
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Liquidity()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat(['id', 'marketAddress', 'network', 'provider', 'base', 'baseAddress', 'quote', 'quoteAddress']),
        )
      : ['*'];
    return select;
  }

  /**
   * getLiquidities finds liquidities
   * @param network The network name
   * @param marketAddress? The market ID (optional)
   * @param provider? Filter by provider address (optional)
   * @param maxOpenDisputes? Allow only records with lower open disputes
   * @param amount Filter by swap amount
   * @param price? Filter by price
   * @param reqLpBadges? Filter by badges liquidity providers must have been granted
   * @param reqSwapBadges
   * @param limit? The number of records to return (optional).
   * @param offset? The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn? Optional transaction object
   */
  static search(
    network: string,
    marketAddress?: string,
    provider?: string,
    maxOpenDisputes?: number,
    amount: string = undefined,
    price?: string,
    reqLpBadges?: string[],
    reqSwapBadges?: string[],
    limit?: number,
    offset?: number,
    select = [],
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn);

    if (!_.isEmpty(reqLpBadges)) {
      q = q.from((sub) => {
        return sub
          .from('liquidities')
          .select('liquidities.*')
          .innerJoin('badge_grants', 'badge_grants.grantee', 'ILIKE', 'liquidities.provider')
          .where('badge_grants.network', network)
          .where((q) => {
            return q
              .whereRaw(`badge_grants.badge ILIKE ANY (?)`, [reqLpBadges])
              .orWhereRaw(`badge_grants.path ILIKE ANY (?)`, [reqLpBadges]);
          })
          .where((q) => {
            return q.whereNull('badge_grants.expireAt').orWhere('badge_grants.expireAt', '>', moment().toISOString());
          })
          .as('s');
      });
    }

    q = q
      .alias('s')
      .select(...select, raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where('s.network', network)
      .where('s.paused', false)
      .where('s.amount', '>', '0');

    if (marketAddress) {
      q = q.where('s.marketAddress', 'ILIKE', marketAddress);
    }

    if (provider) {
      q = q.where('s.provider', 'ILIKE', provider);
    }

    if (maxOpenDisputes) {
      q = q.where('s.openDisputes', '<', maxOpenDisputes);
    }

    if (amount) {
      const operator = amount.startsWith('>') ? '>=' : '<=';
      const amountValue = amount.replace('>', '').replace('<', '');
      q = q.where('s.minSwap', operator, amountValue);
    }

    if (price) {
      const operator = price.startsWith('>') ? '>=' : '<=';
      const amountValue = price.replace('>', '').replace('<', '');
      q = q.where('s.price', operator, amountValue);
    }

    if (!_.isEmpty(reqSwapBadges)) {
      q = q.whereRaw(
        `EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text("requiredSwapBadges") badge
      WHERE badge ILIKE ANY (?)
      )`,
        [reqSwapBadges],
      );
    }

    if (offset) {
      q = q.offset(offset);
    }

    if (limit) {
      q = q.limit(limit);
    }

    return q
      .orderBy('avgFinalizeDur', 'ASC') // prefer low finalize duration
      .orderBy('avgPaymentDur', 'ASC') // prefer low payment duration
      .orderBy('avgReleaseDur', 'ASC') // prefer low release duration
      .orderBy('s.amountSwapped', 'DESC') // prefer higher volume
      .orderBy('s.totalSwaps', 'DESC') // prefer higher number of swaps
      .orderBy('s.completionRate', 'DESC') // prefer higher completion rate
      .orderBy('s.satisfactoryRate', 'DESC') // prefer higher satisfactory rate
      .orderBy('s.updatedAt', 'DESC');
  }

  /**
   * countLiquidities count liquidities by network and optional provider
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param maxOpenDisputes Allow only records with lower open disputes
   * @param txn Optional transaction object
   */
  static countLiquidities(
    network: string,
    marketAddress?: string,
    provider?: string,
    maxOpenDisputes?: number,
    txn?: Transaction,
  ): Promise<Liquidity[]> {
    let q = this.query(txn).whereNotDeleted().where({ network, paused: false });
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
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
        .where('marketAddress', 'ILIKE', mid)
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
  static getLowestPrice(net?: string, mid?: string, baseAddress?: string, withinHours?: number, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) q = q.where({ network: net });
          if (mid) q = q.where('marketAddress', 'ILIKE', mid);
          if (baseAddress) q = q.where('baseAddress', 'ILIKE', baseAddress);
          if (withinHours) q = q.where('createdAt', '>', timeAgo);
          return q;
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
  static getHighestPrice(net: string, mid: string, baseAddress?: string, withinHours?: number, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) return q.where({ network: net });
        })
        .where((q) => {
          if (mid) return q.where('marketAddress', 'ILIKE', mid);
        })
        .where((q) => {
          if (baseAddress) return q.where('baseAddress', 'ILIKE', baseAddress);
        })
        .where('amount', '>', 0)
        .where((q) => {
          if (withinHours) return q.where('createdAt', '>', timeAgo);
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
}

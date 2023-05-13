import { randStr } from '../common/common';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';
import * as moment from 'moment';
import { ToDec } from '../common/common';

/**
 * MarketPrice represents a market's historic price
 */
export default class MarketPrice extends BaseModel {
  // The network name
  network: string;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // The market address
  marketAddress: string;
  // The provider address
  provider: string;
  // The market price
  price: string;

  constructor(init?: Partial<MarketPrice>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_price_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = super.$formatJson(json) as MarketPrice;
    object.object = 'market_price';
    return object;
  }

  static get tableName() {
    return 'market_prices';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MarketPrice>, txn?: Transaction): Promise<MarketPrice> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MarketPrice>, txn?: Transaction): Promise<MarketPrice> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find the recent price before a given date
   * @param network The target network name
   * @param marketAddress The target market ID
   * @param baseAddress The base address of a target asset
   * @param provider The provider address
   * @param before The target date
   * @param txn Optional transaction object
   */
  static async findRecentBefore(
    network: string,
    marketAddress: string,
    baseAddress: string,
    provider: string,
    before: string,
    txn?: Transaction,
  ): Promise<MarketPrice> {
    return this.query(txn)
      .where((q) => {
        if (network) q.where({ network });
      })
      .where((q) => {
        if (marketAddress) q.where('marketAddress', 'ilike', marketAddress);
      })
      .where((q) => {
        if (baseAddress) q.where('baseAddress', 'ilike', baseAddress);
      })
      .where((q) => {
        if (provider) q.where('provider', 'ilike', provider);
      })
      .where('createdAt', '<', before)
      .orderBy('createdAt', 'DESC')
      .first();
  }

  /**
   * Find the recent price
   * @param network The target network name
   * @param marketAddress The target market ID
   * @param baseAddress The base address of a target asset
   * @param provider The provider address
   * @param txn Optional transaction object
   */
  static async findRecent(
    network?: string,
    marketAddress?: string,
    baseAddress?: string,
    provider?: string,
    txn?: Transaction,
  ): Promise<MarketPrice> {
    return this.query(txn)
      .where((q) => {
        if (network) q.where({ network });
      })
      .where((q) => {
        if (marketAddress) q.where('marketAddress', 'ilike', marketAddress);
      })
      .where((q) => {
        if (baseAddress) q.where('baseAddress', 'ilike', baseAddress);
      })
      .where((q) => {
        if (provider) q.where('provider', 'ilike', provider);
      })
      .orderBy('createdAt', 'DESC')
      .first();
  }

  /**
   * Get hourly price change for a market
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address
   * @param hours The price change period in hours
   * @param txn Optional transaction object
   */
  static async priceChange(
    network: string,
    marketAddress: string,
    provider: string,
    hours: number,
    txn?: Transaction,
  ): Promise<number> {
    const timeAgo = moment().subtract(hours, 'h').toISOString();
    const priceHourAgo = await MarketPrice.findRecentBefore(
      network,
      marketAddress,
      undefined,
      provider,
      timeAgo,
      txn,
    );
    if (!priceHourAgo) return Promise.resolve(0);
    const currentPrice = await MarketPrice.findRecent(
      network,
      marketAddress,
      undefined,
      provider,
      txn,
    );
    return Promise.resolve(
      ToDec(currentPrice.price)
        .sub(priceHourAgo.price)
        .div(ToDec(priceHourAgo.price))
        .mul(100)
        .toNumber(),
    );
  }

  /**
   * Get price change by base address
   * @param network The network name
   * @param baseAddress
   * @param hours The price change period in hours
   * @param txn Optional transaction object
   */
  static async priceChangeByBaseAddress(
    network: string,
    baseAddress: string,
    hours: number,
    txn?: Transaction,
  ): Promise<number> {
    const timeAgo = moment().subtract(hours, 'h').toISOString();
    const priceHourAgo = await MarketPrice.findRecentBefore(
      network,
      undefined,
      baseAddress,
      undefined,
      timeAgo,
      txn,
    );
    if (!priceHourAgo) return Promise.resolve(0);
    const currentPrice = await MarketPrice.findRecent(
      network,
      undefined,
      baseAddress,
      undefined,
      txn,
    );
    return Promise.resolve(
      ToDec(currentPrice.price)
        .sub(priceHourAgo.price)
        .div(ToDec(priceHourAgo.price))
        .mul(100)
        .toNumber(),
    );
  }
}

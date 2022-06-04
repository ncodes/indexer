import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * MarketPrice represents a market's historic price
 */
export default class MarketPrice extends BaseModel {
  // The network name
  network: string;
  // The market ID
  mid: string;
  // The market price
  price: string;

  constructor(init?: Partial<MarketPrice>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'market_price_' + crand({ length: 24 });
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
   * create creates a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(
    data: Partial<MarketPrice>,
    txn?: Transaction,
  ): Promise<MarketPrice> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find finds a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(
    q: Partial<MarketPrice>,
    txn?: Transaction,
  ): Promise<MarketPrice> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where(q)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }
}

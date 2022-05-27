import * as crand from 'crypto-random-string';
import Objection from 'objection';
import { BaseModel } from './base';

/**
 * Market represents a market model
 */
export default class Market extends BaseModel {
  // The market ID
  mid: string;
  // The creator of the market
  creator: string;
  // The base asset symbol
  base: string;
  // The quote asset symbol
  quote: string;
  // The block number where the market it was created
  blockNumber: number;
  // The block hash where the market was created
  blockHash: string;

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
   * create creates a record
   * @param data The transfer info
   */
  static create(data: Partial<Market>): Promise<Market> {
    return new Promise((resolve, reject) => {
      return this.query().insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   */
  static getById(id: string): Promise<Market> {
    return this.query().whereNotDeleted().findById(id);
  }

  /**
   * getByMarketId finds a market by market ID
   * @param id The record id
   */
  static getByMarketId(id: string): Promise<Market> {
    return this.query().whereNotDeleted().where({ mid: id }).first();
  }

  /**
   * find finds a record
   * @param q the query parameter
   */
  static find(q: Partial<Market>): Promise<Market> {
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
  static findAll(q: Partial<Market>): Promise<Market[]> {
    return new Promise((resolve, reject) => {
      this.query().where(q).whereNotDeleted().then(resolve).catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   */
  static count(q: Partial<Market>) {
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
  static updateById(id: string, udp: Partial<Market>): Promise<Market> {
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

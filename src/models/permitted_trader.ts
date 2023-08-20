import { randStr } from "../common/common";
import Objection, { raw, Transaction } from "objection";
import { BaseModel } from "./base";

/**
 * PermittedTrader represents a permitted trader
 */
export default class PermittedTrader extends BaseModel {
  // The network name
  network: string;
  // The market address
  marketAddress: string;
  // The permitted address
  address: string;

  constructor(init?: Partial<PermittedTrader>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'permitted_trader_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PermittedTrader;
    object.object = 'permitted_trader';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'permitted_traders';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<PermittedTrader>, txn?: Transaction): Promise<PermittedTrader> {
    return new Promise(async (resolve, reject) => {
      const softDeleted = await this.query(txn).where(data).whereDeleted().first();
      if (softDeleted) {
        await this.query(txn).where('id', softDeleted.id).patch({ deletedAt: null });
        delete softDeleted.deletedAt;
        return resolve(softDeleted);
      }

      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PermittedTrader>, txn?: Transaction): Promise<PermittedTrader> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find a record my network, market ID and address
   * @param network The network name
   * @param marketAddress The market ID
   * @param address The permitted address
   * @param txn Optional transaction object
   */
  static findByNetworkMarketIdAndAddress(network: string, marketAddress: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketAddress', 'ilike', marketAddress)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .first();
  }

  /**
   * remove a permission
   * @param network The network name
   * @param marketAddress The market ID
   * @param address The permitted address
   * @param txn Optional transaction object
   */
  static remove(network: string, marketAddress: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketAddress', 'ilike', marketAddress)
      .where('address', 'ilike', address)
      .delete();
  }

  /**
   * searchByNetworkMarketID searches for records by network and market ID
   * @param network The network name
   * @param marketAddress The market ID
   * @param limit The result limit
   * @param offset The offset value
   * @param txn Optional transaction object
   */
  static searchByNetworkMarketID(
    network: string,
    marketAddress: string,
    limit: number,
    offset: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn).select(raw('*, count(*) over() as "$queryCount"')).where('network', 'ILIKE', network);
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
    if (offset != undefined) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

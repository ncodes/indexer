import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * ProviderRegistry contains information about a provider
 */
export default class ProviderRegistry extends BaseModel {
  network: string = undefined;
  address: string = undefined;
  index: number = undefined;

  constructor(init?: Partial<ProviderRegistry>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'provider_registry';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'prov_reg_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as ProviderRegistry;
    object.object = 'provider_registry';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<ProviderRegistry>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<ProviderRegistry>, txn?: Transaction): Promise<ProviderRegistry> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * Find a record by network and address
   * @param network The network name
   * @param address The provider address
   * @param txn Optional transaction object
   */
  static getByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('network', network).where('address', 'ilike', address).first();
  }
}

import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterOrg contains information about a pay router organization
 */
export default class PayRouterOrg extends BaseModel {
  network: string = undefined;
  creator: string = undefined;
  name: string = undefined;
  orgId: number = undefined;

  constructor(init?: Partial<PayRouterOrg>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_orgs';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_org_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterOrg;
    object.object = 'pr_org';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterOrg>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterOrg>, txn?: Transaction): Promise<PayRouterOrg> {
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
   * Find a record by network and orgId
   * @param network The network
   * @param orgId The organization ID
   * @param txn Optional transaction object
   */
  static findByNetworkAndOrgId(network: string, orgId: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, orgId }).first();
  }

  /**
   * Find a record by network, creator and name
   * @param network The network
   * @param creator The creator
   * @param name The name
   * @param txn Optional transaction object
   */
  static findByNetworkAndCreatorAndName(network: string, creator: string, name: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, creator }).where('name', 'ilike', name).first();
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterOrg>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }

  /**
   * Delete a record by network and orgId
   * @param network The network
   * @param orgId The organization ID
   * @param txn Optional transaction object
   */
  static deleteByNetworkAndOrgId(network: string, orgId: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, orgId }).delete();
  }

  /**
   * Find all records by network
   * @param network The network
   * @param txn Optional transaction object
   */
  static findAllByNetwork(network: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network });
  }
}

import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterRequester contains information about a pay router requester
 */
export default class PayRouterRequester extends BaseModel {
  network: string = undefined;
  address: string = undefined;
  feeBp: number = undefined;
  valueLockDur: number = undefined;

  constructor(init?: Partial<PayRouterRequester>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_requesters';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_requester_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterRequester;
    object.object = 'pr_requester';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterRequester>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterRequester>, txn?: Transaction): Promise<PayRouterRequester> {
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
   * @param network The network
   * @param address The address
   * @param txn Optional transaction object
   */
  static findByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, address }).first();
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterRequester>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }
}

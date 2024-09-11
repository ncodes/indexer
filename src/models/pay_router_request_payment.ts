import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterRequestPayment contains information about a pay router request payment
 */
export default class PayRouterRequestPayment extends BaseModel {
  network: string = undefined;
  payer: string = undefined;
  requestId: string = undefined;
  routeId: string = undefined;
  bond: string = undefined;

  constructor(init?: Partial<PayRouterRequestPayment>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_request_payments';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_req_paym_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterRequestPayment;
    object.object = 'pr_req_paym';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterRequestPayment>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterRequestPayment>, txn?: Transaction): Promise<PayRouterRequestPayment> {
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
   * Find a record by network, requestId, and routeId
   * @param network The network
   * @param requestId The requestId
   * @param routeId The routeId
   * @param txn Optional transaction object
   */
  static findByNetworkRequestIdAndRouteId(network: string, requestId: string, routeId: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, requestId, routeId }).first();
  }

  /**
   * Find all records by network and route ID
   * @param network The network
   * @param routeId The route ID
   * @param txn Optional transaction object
   */
  static findAllByNetworkAndRouteId(network: string, routeId: string, txn?: Transaction) {
    return this.query(txn).where({ network, routeId });
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterRequestPayment>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }
}

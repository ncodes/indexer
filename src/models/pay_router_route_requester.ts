import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterRouteRequester maps routes to requesters
 */
export default class PayRouterRouteRequester extends BaseModel {
  network: string = undefined;
  routeId: string = undefined;
  requesterId: string = undefined;

  constructor(init?: Partial<PayRouterRouteRequester>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_routes_requesters';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_route_requester_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterRouteRequester;
    object.object = 'pr_route_requester';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterRouteRequester>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterRouteRequester>, txn?: Transaction): Promise<PayRouterRouteRequester> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  static findAllByNetworkAndRouteId(network: string, routeId: string, txn?: Transaction) {
    return this.query(txn).where({ network: network, routeId: routeId });
  }

  /**
   * Find a record by network, route ID, and requester ID
   * @param network The network
   * @param routeId The route ID
   * @param requesterId The requester ID
   * @param txn Optional transaction object
   */
  static findByNetworkAndRouteIdAndRequesterId(
    network: string,
    routeId: string,
    requesterId: string,
    txn?: Transaction,
  ) {
    return this.query(txn).where({ network: network, routeId: routeId, requesterId: requesterId });
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
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterRouteRequester>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }

  /**
   * Delete a record by network, route ID, and requester ID
   * @param network The network
   * @param routeId The route ID
   * @param requesterId The requester ID
   * @param txn Optional transaction object
   */
  static deleteByNetworkAndRouteIdAndRequesterId(
    network: string,
    routeId: string,
    requesterId: string,
    txn?: Transaction,
  ) {
    return this.query(txn).where({ network: network, routeId, requesterId }).delete();
  }
}

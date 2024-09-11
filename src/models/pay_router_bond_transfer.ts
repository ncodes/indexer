import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterBondTransfer contains information about a pay router bond transfer
 */
export default class PayRouterBondTransfer extends BaseModel {
  network: string = undefined;
  requestId: string = undefined;
  routeId: string = undefined;
  beneficiary: string = undefined;
  amount: string = undefined;

  constructor(init?: Partial<PayRouterBondTransfer>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_bond_transfers';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_bond_transfer_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterBondTransfer;
    object.object = 'pr_bond_transfer';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterBondTransfer>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterBondTransfer>, txn?: Transaction): Promise<PayRouterBondTransfer> {
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
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterBondTransfer>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }

  /**
   * Find records by network and requestId
   * @param network The network
   * @param requestId The requestId
   * @param txn Optional transaction object
   */
  static findByNetworkAndRequestId(network: string, requestId: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, requestId });
  }

  /**
   * Find records by network, requestId, and routeId
   * @param network The network
   * @param requestId The requestId
   * @param routeId The routeId
   * @param txn Optional transaction object
   */
  static findByNetworkRequestIdAndRouteId(network: string, requestId: string, routeId: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, requestId, routeId });
  }
}

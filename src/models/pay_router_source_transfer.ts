import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PayRouterSourceTransfer contains information about a pay router source transfer
 */
export default class PayRouterSourceTransfer extends BaseModel {
  network: string = undefined;
  requestId: string = undefined;
  beneficiary: string = undefined;
  amount: string = undefined;

  constructor(init?: Partial<PayRouterSourceTransfer>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_source_transfers';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_source_transfer_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterSourceTransfer;
    object.object = 'pr_source_transfer';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterSourceTransfer>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterSourceTransfer>, txn?: Transaction): Promise<PayRouterSourceTransfer> {
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
  static updateById(id: string, data: Partial<PayRouterSourceTransfer>, txn?: Transaction) {
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
   * Find records by network, requestId, and beneficiary
   * @param network The network
   * @param requestId The requestId
   * @param beneficiary The beneficiary
   * @param txn Optional transaction object
   */
  static findByNetworkRequestIdAndBeneficiary(
    network: string,
    requestId: string,
    beneficiary: string,
    txn?: Transaction,
  ) {
    return this.query(txn).whereNotDeleted().where({ network, requestId, beneficiary });
  }
}

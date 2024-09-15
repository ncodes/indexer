import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PaymentMethod contains information about a payment method
 */
export default class PaymentMethod extends BaseModel {
  userId: string = undefined;
  orgId: string = undefined;
  network: string = undefined;
  type: number = undefined;
  name: string = undefined;
  accountId: string = undefined;
  bankAccountNumber: string = undefined;
  bankAccountName: string = undefined;
  routingNumber: string = undefined;
  swiftCode: string = undefined;
  additionalInfo: string = undefined;

  constructor(init?: Partial<PaymentMethod>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'payment_methods';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pm_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PaymentMethod;
    object.object = 'payment_method';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PaymentMethod>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PaymentMethod>, txn?: Transaction): Promise<PaymentMethod> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  static findByUserIdAndNetwork(userId: string, network: string) {
    return this.query()
      .where({ userId })
      .where((q) => {
        if (network) q.where({ network });
      })
      .whereNotDeleted();
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
  static updateById(id: string, data: Partial<PaymentMethod>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }

  /**
   * Find a record by network, org ID and user ID
   * @param network The network
   * @param orgId The org ID
   * @param userId The user ID
   */
  static findByNetworkAndOrgIdAndUserId(network: string, orgId: string, userId: string) {
    return this.query().where({ network, orgId, userId }).first();
  }

  /**
   * Get distinct payment method owned by a user
   * @param userId The user ID
   * @param excludeNetwork The network to exclude
   * @returns
   */
  static getDistintByUser(userId: string, excludeNetwork?: string) {
    return this.query()
      .whereNotDeleted()
      .where({ userId })
      .where((b) => {
        if (excludeNetwork) b.whereNot({ network: excludeNetwork });
      })
      .distinctOn(['name'])
      .select('*');
  }
}

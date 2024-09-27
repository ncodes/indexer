import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import PayRouterRequestPayment from './pay_router_request_payment';
import PayRouterRoute from './pay_router_route';
import PaymentMethod from './payment_method';

/**
 * PayRouterRequest contains information about a pay router request
 */
export default class PayRouterRequest extends BaseModel {
  network: string = undefined;
  creator: string = undefined;
  requestId: number = undefined;
  requesterFeeBp: number = undefined;
  protocolFeeBp: number = undefined;
  valueLockDuration: number = undefined;
  sourceAmt: string = undefined;
  orgSourcePaid: boolean = undefined;
  closed: boolean = undefined;
  cancelled: boolean = undefined;
  orderId: number = undefined;
  routeIds: number[] = undefined;
  routeFees: string[] = undefined;
  routePaymentMethodIds: string[] = undefined;

  // Relations
  routes: PayRouterRoute[] = undefined;
  routePayments: PayRouterRequestPayment[] = undefined;

  constructor(init?: Partial<PayRouterRequest>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_requests';
  }

  static get relationMappings() {
    return {
      routePayments: {
        relation: BaseModel.HasManyRelation,
        modelClass: PayRouterRequestPayment,
        join: {
          from: 'pay_router_requests.id',
          to: 'pay_router_request_payments.requestId',
        },
      },
    };
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_request_' + randStr(24);
    this.routeIds = JSON.stringify(this.routeIds) as any;
    this.routeFees = JSON.stringify(this.routeFees) as any;
    this.routePaymentMethodIds = JSON.stringify(this.routePaymentMethodIds) as any;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterRequest;
    object.object = 'pr_request';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterRequest>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterRequest>, txn?: Transaction): Promise<PayRouterRequest> {
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
   * Find a record by network and requestId
   * @param network The network
   * @param requestId The requestId
   * @param txn Optional transaction object
   */
  static findByNetworkAndRequestId(network: string, requestId: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, requestId }).first();
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterRequest>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }
}

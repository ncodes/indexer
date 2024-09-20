import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import PayRouterOrg from './pay_router_org';
import PaymentMethod from './payment_method';

export enum SourceType {
  Token = 0,
  Native = 1,
  Org = 2,
}

/**
 * PayRouterRoute contains information about a pay router route
 */
export default class PayRouterRoute extends BaseModel {
  network: string = undefined;
  owner: string = undefined;
  routeId: number = undefined;
  source: SourceType = undefined;
  sourceOrgId: number = undefined;
  sourceToken: string = undefined;
  destOrgId: number = undefined;
  bond: string = undefined;
  paymentMethodId: string = undefined;
  fee: number;

  // Relations
  sourceOrg: PayRouterOrg = undefined;
  destOrg: PayRouterOrg = undefined;
  paymentMethod: PaymentMethod = undefined;

  constructor(init?: Partial<PayRouterRoute>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'pay_router_routes';
  }

  static get relationMappings() {
    return {
      sourceOrg: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: PayRouterOrg,
        join: {
          from: 'pay_router_routes.sourceOrgId',
          to: 'pay_router_orgs.orgId',
        },
      },
      destOrg: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: PayRouterOrg,
        join: {
          from: 'pay_router_routes.destOrgId',
          to: 'pay_router_orgs.orgId',
        },
      },
      paymentMethod: {
        relation: BaseModel.HasOneRelation,
        modelClass: PaymentMethod,
        join: {
          from: 'pay_router_routes.paymentMethodId',
          to: 'payment_methods.id',
        },
      },
    };
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pr_route_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PayRouterRoute;
    object.object = 'pr_route';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The data
   * @param txn The transaction object
   */
  static create(data: Partial<PayRouterRoute>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PayRouterRoute>, txn?: Transaction): Promise<PayRouterRoute> {
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
   * Find a record by ID and owner
   * @param id The record id
   * @param owner The owner address
   * @param txn Optional transaction object
   * @returns
   */
  static getByIdAndOwner(id: string, owner: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ id }).where('owner', 'ilike', owner).first();
  }

  /**
   * Find records by network and owner
   * @param network The network
   * @param owner The owner address
   * @param txn Optional transaction object
   */
  static findByNetworkAndOwner(network: string, owner: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, owner });
  }

  /**
   * Find a record by network and route ID
   * @param network The network
   * @param routeId The route ID
   * @param txn Optional transaction object
   */
  static findByNetworkAndRouteId(network: string, routeId: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, routeId }).first();
  }

  /**
   * Update a record by ID
   * @param id The record id
   * @param data The data
   * @param txn Optional transaction object
   */
  static updateById(id: string, data: Partial<PayRouterRoute>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, data);
  }

  /**
   * Find records by destination organization ID
   * @param network The network (optional)
   * @param destOrgId The destination organization ID
   * @param txn Optional transaction object
   * @returns
   */
  static findByNetworkAndDestination(
    network: string = undefined,
    destOrgId: number,
    minBond: string = undefined,
    select: string[] = [],
    pmSelect: string[] = [],
    txn?: Transaction,
  ) {
    let q = this.query(txn);
    if (select.length > 0) {
      q = q.select(select);
    }

    return q
      .whereNotDeleted()
      .whereNotNull('paymentMethodId')
      .where((q) => {
        if (network) q.where({ network });
        if (minBond) q.where('bond', '>=', minBond);
      })
      .where({ destOrgId })
      .withGraphFetched('[sourceOrg,destOrg,paymentMethod]')
      .modifyGraph('paymentMethod', (q) => {
        if (pmSelect.length > 0) q.select(pmSelect);
      });
  }
}

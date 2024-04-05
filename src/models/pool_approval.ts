import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * PoolApproval represents a approval record of a pool
 */
export default class PoolApproval extends BaseModel {
  // The network name
  network: string;
  // The approved market or wallet address
  address: string;
  // The pool ID
  poolId: number;
  // Indicates if the address is a market or wallet
  isMarket: boolean;
  // Indicates the target address has been approved
  approved: boolean;

  constructor(init?: Partial<PoolApproval>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'pool_approv_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as PoolApproval;
    object.object = 'pool_approv';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'pool_approvals';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<PoolApproval>, txn?: Transaction): Promise<PoolApproval> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<PoolApproval>, txn?: Transaction): Promise<PoolApproval> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  // Get by network, poolId and address. Use ilike for address
  static getByNetworkPoolIdAddress(network: string, poolId: number, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, poolId }).where('address', 'ilike', address).first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<PoolApproval>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Delete a record by ID
   * @param id The record ID
   * @param txn Optional transaction object
   * @returns
   */
  static deleteById(id: string, txn?: Transaction) {
    return this.query(txn).where({ id }).delete();
  }
}

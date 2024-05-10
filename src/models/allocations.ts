import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * Allocation represents a lucky code entry
 */
export default class Allocation extends BaseModel {
  // A unique identifier
  name: string;
  // The owner of the allocation
  owner: string;
  // The actual amount of the allocation
  amount: string;
  // Whether the allocation has been claimed
  claimed: boolean;

  constructor(init?: Partial<Allocation>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'alloc_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Allocation;
    object.object = 'alloc';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'allocations';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Allocation>, txn?: Transaction): Promise<Allocation> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Allocation>, txn?: Transaction): Promise<Allocation> {
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

  /**
   * Get a record by name
   * @param name The name of the record
   * @param txn Optional transaction object
   * @returns
   */
  static getByName(name: string, txn?: Transaction) {
    return this.query(txn).where('name', 'ilike', name).whereNotDeleted().first();
  }

  /**
   * Get a record by code and address
   * @param code The code to search for
   * @param address The address to search for
   * @param txn Optional transaction object
   * @returns
   */
  static getByCodeAndAddress(code: string, address: string, txn?: Transaction) {
    return this.query(txn).where('name', 'ilike', code).where('owner', 'ilike', address).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Allocation>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Get total sum of unclaimed allocations
   * @param address The address
   * @param userId Optional user ID
   * @param txn Optional transaction object
   * @returns
   */
  static getTotalUnclaimed(address: string, userId?: string, txn?: Transaction) {
    return this.query(txn)
      .where((q) => {
        q = q.where('owner', 'ilike', address);
        if (userId) q.orWhere('owner', userId);
        return q;
      })
      .where('claimed', false)
      .sum('amount as total')
      .first()
      .then((res) => {
        return (res as unknown as { total: string }).total || '0';
      });
  }
}

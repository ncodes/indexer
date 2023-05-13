import { BaseModel } from './base';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';

/**
 * BadgeGrant represents a granted badge
 */
export default class BadgeGrant extends BaseModel {
  // The network where the badge was granted
  network: string = undefined;
  // The badge assigned to the grantee
  badge: string = undefined;
  // The path part of a badge
  path: string = undefined;
  // The issuer address
  grantee: string = undefined;
  // The co-issuer address
  expireAt: string = undefined;
  // The issued badge metadata
  metadata: { [key: string]: string } = undefined;

  constructor(init?: Partial<BadgeGrant>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'badge_grants';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'badge_grant_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as BadgeGrant;
    object.object = 'badge_grant';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The grant data
   * @param txn The transaction object
   */
  static create(data: Partial<BadgeGrant>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<BadgeGrant>, txn?: Transaction): Promise<BadgeGrant> {
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
   * Updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<BadgeGrant>, txn?: Transaction): Promise<BadgeGrant> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  static deleteByNetAndBadgeAndPath(
    network: string,
    badge: string,
    path: string,
    txn?: Objection.Transaction,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where((q) => {
          if (network) return q.where({ network });
        })
        .where({ badge })
        .where((q) => {
          if (path !== undefined) return q.where({ path });
        })
        .delete()
        .then(resolve)
        .catch(reject);
    });
  }
}

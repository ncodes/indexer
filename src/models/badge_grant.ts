import { BaseModel } from './base';
import Objection, { raw, Transaction } from 'objection';
import { randStr } from '../common/common';
import { uniq } from 'lodash';

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
  // The recipient of the badge
  grantee: string = undefined;
  // The expiration date of the badge
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
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Deletes a record by its network, badge, and path
   * @param network The network name
   * @param badge The badge name
   * @param path The path part of the badge
   * @param txn Optional transaction object
   */
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

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new BadgeGrant()).includes(x));
    select = select.length ? uniq(select.concat(['id', 'badge', 'path'])) : ['*'];
    return select;
  }

  /**
   * search for badges
   * @param network The network name
   * @param badge The badge to filter by
   * @param path The path to filter by
   * @param grantee The grantee address to filter by
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param txn Optional transaction object
   */
  static search(
    network?: string,
    badge?: string,
    path?: string,
    grantee?: string,
    countOnly?: boolean,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let query = this.query(txn);
    query = !countOnly ? query.select(...select, raw('count(*) over() as' + ' "__queryCount"')) : query;
    if (network) query = query.where('network', 'ilike', network);
    if (badge) query = query.where('badge', badge);
    if (path) query = query.where('path', path);
    if (grantee) query = query.where('grantee', 'ilike', grantee);
    if (countOnly) {
      return query
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.whereNotDeleted().orderBy('updatedAt', 'DESC');
  }
}

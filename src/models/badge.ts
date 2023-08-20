import { BaseModel } from "./base";
import Objection, { raw, Transaction } from "objection";
import { randStr } from "../common/common";
import { uniq } from "lodash";

/**
 * Badge represents a badge
 */
export default class Badge extends BaseModel {
  // The network where the issuer operate
  network: string = undefined;
  // The badge assigned to the issuer
  badge: string = undefined;
  // The path part of a badge
  path: string = undefined;
  // The issuer address
  issuer: string = undefined;
  // The co-issuer address
  coIssuer: string = undefined;
  // The issued badge metadata
  metadata: { [key: string]: string } = undefined;

  constructor(init?: Partial<Badge>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'badges';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'badge_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Badge;
    object.object = 'badge';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a badge record
   * @param data The issuer data
   * @param txn The transaction object
   */
  static create(data: Partial<Badge>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Badge>, txn?: Transaction): Promise<Badge> {
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
  static updateById(id: string, udp: Partial<Badge>, txn?: Transaction): Promise<Badge> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Updates a record by its issuer address, badge or path
   * @param network The network to limit search to
   * @param address The issuer's address
   * @param badge The issuer's badge
   * @param path The badge's path
   * @param udp the fields to be updated
   * @param txn? Optional transaction object
   */
  static updateByNetAndIssuerAndBadgeAndPath(
    network: string,
    address: string,
    badge: string,
    path: string,
    udp: Partial<Badge>,
    txn?: Objection.Transaction,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where((q) => {
          if (network) return q.where({ network });
        })
        .where('issuer', 'ilike', address)
        .where({ badge })
        .where((q) => {
          if (path !== undefined) return q.where({ path });
        })
        .whereNotDeleted()
        .patch(udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Badge()).includes(x));
    select = select.length ? uniq(select.concat(['id', 'badge', 'path'])) : ['*'];
    return select;
  }

  /**
   * search for badges
   * @param network The network name
   * @param issuer The issuer address to filter by
   * @param coIssuer The co-issuer address to filter by
   * @param badge The badge to filter by
   * @param path The path to filter by
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param txn Optional transaction object
   */
  static search(
    network?: string,
    issuer?: string,
    coIssuer?: string,
    badge?: string,
    path?: string,
    countOnly?: boolean,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let query = this.query(txn);
    query = !countOnly ? query.select(...select, raw('count(*) over() as' + ' "$queryCount"')) : query;
    if (network) query = query.where('network', 'ilike', network);
    if (issuer) query = query.where('issuer', 'ilike', issuer);
    if (coIssuer) query = query.where('coIssuer', 'ilike', coIssuer);
    if (badge) query = query.where('badge', badge);
    if (path) query = query.where('path', path);
    if (countOnly) {
      return query
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }
    if (offset != undefined) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.whereNotDeleted().orderBy('updatedAt', 'DESC');
  }
}

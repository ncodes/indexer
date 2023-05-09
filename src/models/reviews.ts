import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Review manages swap reviews
 */
export default class Review extends BaseModel {
  // The network where the swap occurred
  network: string = undefined;
  // The market ID
  marketId: string = undefined;
  // The swap ID
  swapId?: string = undefined;
  // The user ID of the reviewer
  reviewerId?: string = undefined;
  // The address that was reviewed
  reviewed?: string = undefined;
  // Indicate the reviewer was satisfied (GREEN)
  satisfied: boolean = undefined;
  // The optional comment by the reviewer
  comment: string;

  constructor(init?: Partial<Review>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'review_' + randStr(24);
  }

  $beforeUpdate() {
    super.$beforeUpdate();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Review;
    object.object = 'review';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'reviews';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Review>, txn?: Transaction): Promise<Review> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Review>, txn?: Transaction): Promise<Review> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Get a record by ID
   * @param id The record ID
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).where({ id }).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Review>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Check if a user has reviewed a swap
   * @param reviewerId The user ID of the reviewer
   * @param swapId The swap ID
   * @param txn The transaction object
   */
  static isSwapReviewed(reviewerId: string, swapId: string, txn?: Objection.Transaction) {
    return new Promise<boolean>((resolve, reject) => {
      this.query(txn)
        .where({ reviewerId, swapId })
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count !== '0');
        })
        .catch(reject);
    });
  }

  /**
   * Check the number of reviews received by an address.
   * @param reviewed The address of the review receiver
   * @param txn The transaction object
   */
  static countReceived(reviewed: string, txn?: Objection.Transaction) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(parseInt(res.count));
        })
        .catch(reject);
    });
  }

  /**
   * Check the number of satisfied reviews received by an address.
   * @param reviewed The address of the review receiver
   * @param txn The transaction object
   */
  static countSatisfiedReceived(reviewed: string, txn?: Objection.Transaction) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .where('reviewed', 'ilike', reviewed)
        .where({ satisfied: true })
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(parseInt(res.count));
        })
        .catch(reject);
    });
  }

  /**
   * Get the satisfactory rate of a reviewed address
   * @param reviewed The address that was reviewed
   * @param trx The optional database transaction
   */
  static async getSatisfactoryRate(reviewed: string, trx?: Transaction): Promise<number> {
    const numReceivedReviews = await Review.countReceived(reviewed, trx);
    const numSatisfiedReceived = await Review.countSatisfiedReceived(reviewed, trx);
    const sr = (numSatisfiedReceived / numReceivedReviews) * 100 || 0;
    return Promise.resolve(sr);
  }

  /**
   * searchReviews finds reviews
   * @param network The network name
   * @param reviewedAddress The reviewed address
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param txn Optional transaction object
   */
  static searchReviews(
    network: string,
    reviewedAddress?: string,
    limit?: number,
    offset?: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn)
      .select('*', raw('count(*) over() as' + ' "__queryCount"'))
      .whereNotDeleted()
      .where({ network });
    if (reviewedAddress) q = q.where('reviewed', 'ILIKE', reviewedAddress);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * countReviews count liquidities by network and optional provider
   * @param network The network name
   * @param reviewedAddress The reviewed address
   * @param txn Optional transaction object
   */
  static countReviews(
    network: string,
    reviewedAddress?: string,
    txn?: Transaction,
  ): Promise<Review[]> {
    let q = this.query(txn).whereNotDeleted().where({ network });
    if (reviewedAddress) q = q.where('reviewed', 'ILIKE', reviewedAddress);
    return q
      .count('id')
      .first()
      .then((res: any) => res.count);
  }
}

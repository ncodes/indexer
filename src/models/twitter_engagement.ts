import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * TwitterEngagement represents twitter engagement
 */
export default class TwitterEngagement extends BaseModel {
  twitterUserId: string;
  userId: string;
  address: string;
  tweetId: string;
  type: string;
  referencedTweetId: string;
  pointAwarded: boolean;

  constructor(init?: Partial<TwitterEngagement>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'twitter_engmt_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TwitterEngagement;
    object.object = 'twitter_engmt';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'twitter_engagements';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<TwitterEngagement>, txn?: Transaction): Promise<TwitterEngagement> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<TwitterEngagement>, txn?: Transaction): Promise<TwitterEngagement> {
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

  // Get type and tweetId
  static getByTypeAndTweetId(type: string, tweetId: string, txn?: Transaction) {
    return this.query(txn).where({ type, tweetId }).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<TwitterEngagement>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

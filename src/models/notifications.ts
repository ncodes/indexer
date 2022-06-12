import * as crand from 'crypto-random-string';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Notification represents a notification
 */
export default class Notification extends BaseModel {
  // The network name
  network: string;
  // The user ID
  userId: string;
  // The title of the message
  title: string;
  // The body of the message
  body: string;

  constructor(init?: Partial<Notification>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'notification_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Notification;
    object.object = 'notification';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'notifications';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Notification>, txn?: Transaction): Promise<Notification> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Notification>, txn?: Transaction): Promise<Notification> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }
}

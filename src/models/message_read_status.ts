import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * MessageReadStatus tracks the `read` status of a message
 */
export default class MessageReadStatus extends BaseModel {
  // The message ID
  msgId?: string = undefined;
  // The user ID of the message recipient
  userId?: string = undefined;
  // Indicate read status
  read: boolean = undefined;

  constructor(init?: Partial<MessageReadStatus>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'msg_read_status_' + crand({ length: 24 });
  }

  $beforeUpdate() {
    super.$beforeUpdate();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MessageReadStatus;
    object.object = 'msg_read_status';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'message_read_statuses';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MessageReadStatus>, txn?: Transaction): Promise<MessageReadStatus> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MessageReadStatus>, txn?: Transaction): Promise<MessageReadStatus> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Get a message by ID
   * @param id The record ID
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<MessageReadStatus> {
    return this.query(txn).where({ id }).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(
    id: string,
    udp: Partial<MessageReadStatus>,
    txn?: Transaction,
  ): Promise<MessageReadStatus> {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * markRead sets read status to true
   * @param msgId The message ID
   * @param userId The user ID
   * @param txn Optional transaction object
   */
  static markRead(msgId: string, userId: string, txn?: Transaction): Promise<number> {
    return this.query(txn)
      .whereNotDeleted()
      .where({
        msgId,
        userId,
      })
      .patch({ read: true });
  }

  /**
   * Count number of unread messages associated to a user ID
   * @param userId The user ID
   * @param txn The transaction object
   */
  static countByUserId(userId: string, txn?: Objection.Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where({ userId, read: false })
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }
}

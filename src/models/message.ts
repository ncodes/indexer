import * as crand from 'crypto-random-string';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import { isString } from 'class-validator';

/**
 * Message represents an encrypted message
 */
export default class Message extends BaseModel {
  // The network name
  network?: string = undefined;
  // The market ID
  marketId?: string = undefined;
  // The swap ID the message is associated to
  swapId?: string = undefined;
  // The order index on the contract
  orderId?: number = undefined;
  // The encrypted messages
  messages?: string[] = undefined;
  // The user ID of the sender
  fromId?: string = undefined;
  // The user ID of the recipients
  recipientsId?: string[] = undefined;
  // The message public key of the recipients
  recipientsMsgPubKey?: string[] = undefined;

  constructor(init?: Partial<Message>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    if (!this.id) this.id = Message.genID();
    this.recipientsId = JSON.stringify(this.recipientsId) as any;
    this.messages = JSON.stringify(this.messages) as any;
    this.recipientsMsgPubKey = JSON.stringify(this.recipientsMsgPubKey) as any;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    if (this.recipientsId) this.recipientsId = JSON.stringify(this.recipientsId) as any;
    if (this.messages) this.messages = JSON.stringify(this.messages) as any;
    if (this.recipientsMsgPubKey)
      this.recipientsMsgPubKey = JSON.stringify(this.recipientsMsgPubKey) as any;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Message;
    object.object = 'msg';
    if (isString(object.recipientsId)) object.recipientsId = JSON.parse(this.recipientsId as any);
    if (isString(object.messages)) object.messages = JSON.parse(this.messages as any);
    if (isString(object.recipientsMsgPubKey))
      object.recipientsMsgPubKey = JSON.parse(this.recipientsMsgPubKey as any);
    delete object.deletedAt;
    return object;
  }

  static genID() {
    return 'msg_' + crand({ length: 24 });
  }

  static get tableName() {
    return 'messages';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Message>, txn?: Transaction): Promise<Message> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Message>, txn?: Transaction): Promise<Message> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Get messages associated with a swap ID
   * @param id The swap ID
   * @param limit Limit the number of messages returned
   * @param beforeSerial
   * @param txn Optional transaction object
   */
  static getBySwapId(
    id: string,
    limit = 50,
    beforeSerial: number,
    txn?: Transaction,
  ): Promise<Message[]> {
    let q = this.query(txn).where({ swapId: id });
    if (beforeSerial) q = q.where('sn', '<', beforeSerial);
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC').limit(limit);
  }

  /**
   * Get a message by ID
   * @param id The swap ID
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<Message> {
    return this.query(txn).where({ id }).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Message>, txn?: Transaction): Promise<Message> {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }
}

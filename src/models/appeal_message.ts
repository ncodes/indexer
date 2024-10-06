import Objection, { Model, Transaction } from 'objection';
import { randStr } from '../common/common';
import Appeal from './appeal';
import { BaseModel } from './base';
import Swap from './swap';
import User from './user';

/**
 * Appeal represents an apeeal message
 */
export default class AppealMessage extends BaseModel {
  appealId: string = undefined;
  orderId: string = undefined;
  creatorId: string = undefined;
  text: string = undefined;
  files: string[] = undefined;
  fileUrls: string[] = undefined;

  // Relations
  appeal: Appeal = undefined;
  order: Swap = undefined;
  creator: User = undefined;

  constructor(init?: Partial<AppealMessage>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'appeal_msg_' + randStr(24);
    this.files = this.files ? (JSON.stringify(this.files) as any) : this.files;
    this.fileUrls = this.fileUrls ? (JSON.stringify(this.fileUrls) as any) : this.fileUrls;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.files = this.files ? (JSON.stringify(this.files) as any) : this.files;
    this.fileUrls = this.fileUrls ? (JSON.stringify(this.fileUrls) as any) : this.fileUrls;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Appeal;
    object.object = 'appeal_msg';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'appeal_messages';
  }

  static get relationMappings() {
    return {
      appeal: {
        relation: Model.BelongsToOneRelation,
        modelClass: Appeal,
        join: {
          from: 'appeal_messages.appealId',
          to: 'appeals.id',
        },
      },
      order: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: 'appeal_messages.orderId',
          to: 'swaps.id',
        },
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'appeal_messages.creatorId',
          to: 'users.id',
        },
      },
    };
  }

  /**
   * Create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<AppealMessage>, txn?: Transaction): Promise<AppealMessage> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<AppealMessage>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find records by appealId
   * @param appealId The appeal id
   * @param creatorId The creator id
   * @param limit The limit of records to fetch
   * @param txn Optional transaction object
   */
  static findByAppealId(appealId: string, creatorId?: string, limit?: number, txn?: Transaction) {
    const q = this.query(txn)
      .where('appealId', appealId)
      .where((q) => {
        if (creatorId) q.where('creatorId', creatorId);
      })
      .whereNotDeleted()
      .orderBy('createdAt', 'desc');

    if (limit) q.limit(limit);
    return q;
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param relations The relations to fetch
   * @param txn Optional transaction object
   */
  static getById(id: string, relations = '', txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id).withGraphFetched(relations);
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<AppealMessage>, txn?: Transaction): Promise<AppealMessage> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

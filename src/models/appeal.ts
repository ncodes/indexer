import Objection, { Model, Transaction } from 'objection';
import { randStr } from '../common/common';
import AppealMessage from './appeal_message';
import { BaseModel } from './base';
import Swap from './swap';
import User from './user';

/**
 * Appeal represents an apeeal
 */
export default class Appeal extends BaseModel {
  // The network name
  network: string = undefined;
  // The order ID
  orderId: string = undefined;
  // The creator of the appeal
  creatorId: string = undefined;
  // The issue description
  issue: string = undefined;
  // Indicates whether the appeal is closed
  closed: boolean = undefined;

  // Relations
  order: Swap = undefined;
  creator: User = undefined;

  constructor(init?: Partial<Appeal>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'appeal_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Appeal;
    object.object = 'appeal';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'appeals';
  }

  static get relationMappings() {
    return {
      order: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: 'appeals.orderId',
          to: 'swaps.id',
        },
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'appeals.creatorId',
          to: 'users.id',
        },
      },
      messages: {
        relation: Model.HasManyRelation,
        modelClass: AppealMessage,
        join: {
          from: 'appeals.id',
          to: 'appeal_messages.appealId',
        },
      },
    };
  }

  /**
   * Create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Appeal>, txn?: Transaction): Promise<Appeal> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Appeal>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
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
  static updateById(id: string, udp: Partial<Appeal>, txn?: Transaction): Promise<Appeal> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Get an appeal by network and order ID
   * @param network The network name
   * @param orderId The order ID
   * @param txn Optional transaction object
   * @returns The appeal
   */
  static getByNetworkAndOrderId(network: string, orderId: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ network, orderId }).first();
  }
}

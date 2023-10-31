import Objection, { Model, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import Offer from './offer';
import Swap from './swap';

/**
 * Convo represents a chat conversation
 */
export default class Convo extends BaseModel {
  // The network name
  network: string;
  // The address of the user
  address: string;
  // The order ID
  orderId: number;
  // The offer ID
  offerId: number;
  // The conversation topic
  topic: string;
  // Indicates whether the user has muted the conversation
  muted: boolean;

  // Relations
  swap: Swap;
  offer: Offer;

  constructor(init?: Partial<Convo>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'convo_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Convo;
    object.object = 'convo';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'convos';
  }

  static get relationMappings() {
    return {
      swap: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: 'convos.orderId',
          to: 'swaps.orderId',
        },
      },
      offer: {
        relation: Model.BelongsToOneRelation,
        modelClass: Offer,
        join: {
          from: 'convos.offerId',
          to: 'offers.offerId',
        },
      },
    };
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Convo>, txn?: Transaction): Promise<Convo> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Convo>, txn?: Transaction): Promise<Convo> {
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

  /**
   * Get by network and topic
   * @param network The network name
   * @param address The address of the user
   * @param topic The topic
   * @param relations Optional relations to be fetched
   * @param txn Optional transaction object
   * @returns
   */
  static get(network: string, address: string, topic: string, relations?: string, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network, topic })
      .where('address', 'ilike', address)
      .withGraphFetched(relations)
      .first();
  }

  /**
   * Get by topic
   * @param topic The topic
   * @param relations Optional relations to be fetched
   * @param txn Optional transaction object
   * @returns
   */
  static getByTopic(topic: string, relations?: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ topic }).withGraphFetched(relations).first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Convo>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * Battle represents a battle event
 */
export default class Battle extends BaseModel {
  allocation: string;

  constructor(init?: Partial<Battle>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'battle_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Battle;
    object.object = 'battle';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'battles';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Battle>, txn?: Transaction): Promise<Battle> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Battle>, txn?: Transaction): Promise<Battle> {
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
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Battle>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  // Get the latest battle
  static getLatestBattle() {
    return this.query().whereNotDeleted().orderBy('createdAt', 'desc').first();
  }
}

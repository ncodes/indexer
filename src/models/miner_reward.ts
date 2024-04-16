import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * MinerReward represents a miner reward event
 */
export default class MinerReward extends BaseModel {
  // The network name
  network: string;
  // The miner address
  address: string;
  // The miner operation
  operation: string;
  // The amount slashed
  amount: string;

  constructor(init?: Partial<MinerReward>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'miner_reward_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MinerReward;
    object.object = 'miner_reward';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'miner_rewards';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MinerReward>, txn?: Transaction): Promise<MinerReward> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MinerReward>, txn?: Transaction): Promise<MinerReward> {
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
  static updateById(id: string, udp: Partial<MinerReward>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

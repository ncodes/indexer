import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * Miner represents a miner
 */
export default class Miner extends BaseModel {
  // The network name
  network: string;
  // The miner address
  address: string;
  // The miner's bond
  bond: string;
  // Indicate whether the miner registration is cancelled
  cancelling: boolean;
  // Indicate whether the miner is drained
  drained: boolean;
  // Indicate whether the miner is blocked
  blocked: boolean;
  // Indicate whether the miner is slashed
  slashed: boolean;
  // The time until the miner bond can be drained
  cancelledAt: string;
  // The miner's ticket
  maturedAt: string;

  constructor(init?: Partial<Miner>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'miner_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Miner;
    object.object = 'miner';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'miners';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Miner>, txn?: Transaction): Promise<Miner> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Miner>, txn?: Transaction): Promise<Miner> {
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
   * getByNetworkAndAddress finds a record by network and address
   * @param network The network name
   * @param address The miner address
   * @param txn
   * @returns
   */
  static getByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).where({ network }).whereRaw('address ilike ?', [address]).first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Miner>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * updateByNetworkAndAddress updates a record by network and address
   * @param network The network name
   * @param address The miner address
   * @param udp The fields to be updated
   * @param txn Optional transaction object
   */
  static updateByNetworkAndAddress(network: string, address: string, udp: Partial<Miner>, txn?: Transaction) {
    return this.query(txn).where({ network }).whereRaw('address ilike ?', [address]).patch(udp);
  }
}

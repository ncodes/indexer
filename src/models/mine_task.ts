import * as _ from 'lodash';
import * as moment from 'moment';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

export enum MineTaskType {
  Draft = 'draft',
  Undraft = 'undraft',
  Execute = 'execute',
  FeeTransfer = 'fee_transfer',
}

/**
 * MineTask represents a mining operation
 */
export default class MineTask extends BaseModel {
  // The type of task
  type: MineTaskType;
  // The network associated with this object
  network: string = undefined;
  // The market address
  marketAddress: string = undefined;
  // The swap order ID
  orderId: number = undefined;
  // The dispute index
  disputeId: number = undefined;
  // Indicate the task has been completed
  completed: boolean = undefined;
  // Address of token whose fee to transfer (for type=fee_transfer)
  token: string = undefined;
  // The time in the future this task can be mined
  mineAt: string = undefined;

  constructor(init?: Partial<MineTask>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'mine_task_' + randStr(24);
    if (!this.mineAt) this.mineAt = moment().toISOString();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MineTask;
    object.object = 'mine_task';
    delete object.deletedAt;
    return _.pickBy(object, _.identity);
  }

  static get tableName() {
    return 'mine_tasks';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<MineTask>, txn?: Transaction): Promise<MineTask> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * Fetch minable tasks
   * @param network The network name
   * @param type The task type
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param txn Optional transaction object
   */
  static fetchMineable(network: string, type?: MineTaskType, limit?: number, offset?: number, txn?: Transaction) {
    let q = this.query(txn).select('*').whereNotDeleted().where({ completed: false });
    if (network) q = q.where({ network });
    if (type) q = q.where({ type });
    if (offset != undefined) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.where('mineAt', '<=', 'now()').orderBy('mineAt', 'ASC');
  }

  /**
   * countTasks counts tasks
   * @param network The network name
   * @param type The task type
   * @param txn Optional transaction object
   */
  static countTasks(network: string, type?: MineTaskType, txn?: Transaction) {
    let q = this.query(txn).whereNotDeleted().where({
      network,
      completed: false,
    });
    if (type) q = q.where({ type });
    return q
      .count('id')
      .first()
      .then((res: any) => res.count);
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MineTask>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static findAll(q: Partial<MineTask>, txn?: Transaction): Promise<MineTask[]> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static count(q: Partial<MineTask>, txn?: Transaction): Promise<number> {
    return this.query(txn)
      .where(q)
      .count('id')
      .first()
      .then((res: any) => parseInt(res.count));
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<MineTask>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).then(resolve).catch(reject);
    });
  }

  /**
   * Mark a single draft task as completed
   * @param network The network name
   * @param marketAddress The market ID
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneDraftTask(
    network: string,
    marketAddress: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where(
        'id',
        'in',
        this.query()
          .select('id')
          .where({
            type: MineTaskType.Draft,
            network,
            orderId,
            disputeId,
            completed: false,
          })
          .where('marketAddress', 'ilike', marketAddress)
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }

  /**
   * Mark a single undraft task as completed
   * @param network The network name
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneUndraftTask(network: string, orderId: number, disputeId: number, txn?: Transaction) {
    return this.query(txn)
      .where(
        'id',
        'in',
        this.query()
          .select('id')
          .where({
            type: MineTaskType.Undraft,
            network,
            orderId,
            disputeId,
            completed: false,
          })
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }

  /**
   * Mark a single execution task as completed
   * @param network The network name
   * @param marketAddress The market ID
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneExecutionTask(
    network: string,
    marketAddress: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where(
        'id',
        'in',
        this.query()
          .select('id')
          .where({
            type: MineTaskType.Execute,
            network,
            orderId,
            disputeId,
            completed: false,
          })
          .where('marketAddress', 'ilike', marketAddress)
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }
}

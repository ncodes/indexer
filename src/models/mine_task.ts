import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

export enum MineTaskType {
  Draft = 'draft',
  Undraft = 'undraft',
  Execute = 'execute',
}

/**
 * MineTask represents a mining operation
 */
export default class MineTask extends BaseModel {
  // The type of task
  type: MineTaskType;
  // The network associated with this object
  network: string = undefined;
  // The market ID
  marketId: string = undefined;
  // The swap order ID
  orderId: number = undefined;
  // The dispute index
  disputeId: number = undefined;
  // Indicate the task has been completed
  completed: boolean;
  // The time in the future this task can be mined
  mineAt: string = undefined;

  constructor(init?: Partial<MineTask>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'mine_task_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as MineTask;
    object.object = 'mine_task';
    delete object.deletedAt;
    return object;
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
      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by Id
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction): Promise<MineTask> {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * getLiquidities finds liquidities
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  // static searchLiquidities(
  //   network: string,
  //   marketId?: string,
  //   provider?: string,
  //   limit?: number,
  //   offset?: number,
  //   select = [],
  //   txn?: Transaction,
  // ): Promise<MineTask[]> {
  //   select = this.makeSelectList(select);
  //   let q = this.query(txn)
  //     .select(...select, raw('count(*) over() as' + ' "__queryCount"'))
  //     .whereNotDeleted()
  //     .where({ network, paused: false });
  //   if (marketId) q = q.where('marketId', 'ILIKE', marketId);
  //   if (provider) q = q.where('provider', 'ILIKE', provider);
  //   if (offset) q = q.offset(offset);
  //   if (limit) q = q.limit(limit);
  //   return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  // }
  //
  // /**
  //  * countLiquidities count liquidities by network and optional provider
  //  * @param network The network name
  //  * @param marketId The market ID (optional)
  //  * @param provider Filter by provider address (optional)
  //  * @param txn Optional transaction object
  //  */
  // static countLiquidities(
  //   network: string,
  //   marketId?: string,
  //   provider?: string,
  //   txn?: Transaction,
  // ): Promise<MineTask[]> {
  //   let q = this.query(txn).whereNotDeleted().where({ network, paused: false });
  //   if (marketId) q = q.where('marketId', 'ILIKE', marketId);
  //   if (provider) q = q.where('provider', 'ILIKE', provider);
  //   return q
  //     .count('id')
  //     .first()
  //     .then((res: any) => res.count);
  // }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<MineTask>, txn?: Transaction): Promise<MineTask> {
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
  static updateById(id: string, udp: Partial<MineTask>, txn?: Transaction): Promise<MineTask> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).then(resolve).catch(reject);
    });
  }

  /**
   * Mark a single draft task as completed
   * @param network The network name
   * @param marketId The market ID
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneDraftTask(
    network: string,
    marketId: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ): Promise<number> {
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
          .where('marketId', 'ilike', marketId)
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }

  /**
   * Mark a single undraft task as completed
   * @param network The network name
   * @param marketId The market ID
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneUndraftTask(
    network: string,
    marketId: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ): Promise<number> {
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
          .where('marketId', 'ilike', marketId)
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }

  /**
   * Mark a single execution task as completed
   * @param network The network name
   * @param marketId The market ID
   * @param orderId The order index
   * @param disputeId The dispute index
   * @param txn Optional transaction object
   */
  static completeOneExecutionTask(
    network: string,
    marketId: string,
    orderId: number,
    disputeId: number,
    txn?: Transaction,
  ): Promise<number> {
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
          .where('marketId', 'ilike', marketId)
          .limit(1),
      )
      .patch({
        completed: true,
      });
  }
}

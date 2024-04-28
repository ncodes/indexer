import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import User from './user';

/**
 * Raffle represents an raffle event
 */
export default class Raffle extends BaseModel {
  hostId: string;
  approved: boolean;
  minTickets: number;
  maxTickets: number;
  numWinners: number;
  ticketsPicked: number;
  winners: string[];
  reward: string;
  hostReward: string;
  posted: boolean;
  pinned: boolean;
  // when the raffle must start.
  // If minimum tickets have not been collected by this time,
  // the raffle is cancelled
  startAt: string;
  ended: boolean;

  // Not persisted
  host?: User;
  status: 'Pending Approval' | 'Pending Announcement' | 'Pending Pin' | 'Active' | 'Ended' | 'Started';

  constructor(init?: Partial<Raffle>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'raffle_' + randStr(24);
  }

  $beforeUpdate() {
    super.$beforeUpdate();
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Raffle;
    object.object = 'raffle';
    delete object.deletedAt;

    return object;
  }

  static get tableName() {
    return 'raffles';
  }

  static get relationMappings() {
    return {
      host: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'raffles.hostId',
          to: 'users.id',
        },
      },
    };
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Raffle>, txn?: Transaction): Promise<Raffle> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Raffle>, txn?: Transaction): Promise<Raffle> {
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
  static updateById(id: string, udp: Partial<Raffle>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Count the number of raffles created by a host within a period
   * @param hostId The host id
   * @param period The period to count raffles
   * @param txn Optional transaction object
   * @returns
   */
  static async countRecentRaffles(hostId: string, period = '7 DAY', txn?: Transaction) {
    return this.query(txn)
      .count('id')
      .where({ hostId })
      .whereNotDeleted()
      .whereRaw(`"createdAt" > NOW() - interval '${period}'`)
      .whereNotDeleted()
      .first()
      .then((res: any) => {
        return parseInt(res.count);
      });
  }

  /**
   * Count the number of active raffles
   * @param hostId The host id
   * @param txn Optional transaction object
   * @returns
   */
  static async countActiveRaffles(hostId: string, txn?: Transaction) {
    return this.query(txn)
      .count('id')
      .where({ hostId })
      .where((q) => {
        q.whereRaw(`"startAt" > NOW()`).orWhereRaw(`ended = false`);
      })
      .whereNotDeleted()
      .first()
      .then((res: any) => {
        return parseInt(res.count);
      });
  }

  // Get active raffles
  static getActiveRaffles(n: number, txn?: Transaction) {
    return this.query(txn)
      .where((q) => {
        q.whereRaw(`ended = false`);
      })
      .whereNotDeleted()
      .withGraphFetched('host')
      .orderBy('ticketsPicked', 'desc')
      .limit(n);
  }
}

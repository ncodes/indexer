import * as moment from 'moment';
import Objection, { Model, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import Market from './market';
import User from './user';

export type QuestType = 'tweet' | 'follow' | 'quote' | 'reply' | 'like' | 'verify' | 'private-sale' | 'swap';

/**
 * Quest represents an airdrop quest
 */
export default class Quest extends BaseModel {
  name: string;
  type: QuestType;
  link: string;
  account: string;
  tag: string;
  engageBond: number;
  verifyBond: number;
  maxVotes: number;
  verifyPoints: number;
  engagePoints: number;
  pinned: boolean;
  ended: boolean;
  priority: number;
  marketAddress: string;
  provider: string;
  lid: number;

  // --- Verify Request State ---
  questId: string;
  // -----------end--------------

  responderId: string;
  responderLink: string;
  voteNo: number;
  voteYes: number;
  finalized: boolean;
  voters: string[];
  votes: Record<string, number>;
  parent: Quest;
  responder: Partial<User>;

  // Not persisted
  market: Market;

  constructor(init?: Partial<Quest>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'quest_' + randStr(24);
    this.voters = this.voters ? (JSON.stringify(this.voters) as any) : this.voters;
    this.votes = this.votes ? (JSON.stringify(this.votes) as any) : this.votes;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.voters = this.voters ? (JSON.stringify(this.voters) as any) : this.voters;
    this.votes = this.votes ? (JSON.stringify(this.votes) as any) : this.votes;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Quest;
    object.object = 'quest';
    delete object.deletedAt;
    delete object.voteYes;
    delete object.voteNo;
    delete object.voters;
    delete object.votes;
    if (object.responder) {
      object.responder = {
        twitterUsername: object.responder.twitterUsername,
      };
    }
    return object;
  }

  static get tableName() {
    return 'quests';
  }

  static get relationMappings() {
    return {
      parent: {
        relation: Model.BelongsToOneRelation,
        modelClass: Quest,
        join: {
          from: ['quests.questId'],
          to: ['quests.id'],
        },
      },
      responder: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: ['quests.responderId'],
          to: ['users.id'],
        },
      },
      market: {
        relation: Model.BelongsToOneRelation,
        modelClass: Market,
        join: {
          from: ['quests.marketAddress'],
          to: ['markets.address'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Quest>, txn?: Transaction): Promise<Quest> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Quest>, txn?: Transaction): Promise<Quest> {
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
   * Get all pinned quests
   * @param txn The optional transaction object
   * @returns
   */
  static getAllPinned(txn?: Transaction) {
    return this.query(txn)
      .where('pinned', true)
      .where('ended', false)
      .orderBy('priority', 'DESC')
      .whereNotDeleted()
      .withGraphFetched('[parent,responder,market]');
  }

  /**
   * Find quests that require voting
   * @param userId The querying user ID
   * @param address The quering user address
   * @param limit The record limit
   * @param txn The optional transaction object
   * @returns
   */
  static findVotableQuests(userId: string, address: string, limit = 5, txn?: Transaction) {
    return this.query(txn)
      .where('pinned', false)
      .where('finalized', false)
      .where((q) => {
        q.where('responderId', '!=', userId).orWhere('responderId', null);
      })
      .where((q) => {
        q.whereJsonNotSupersetOf('voters', [userId]).whereJsonNotSupersetOf('voters', [address]);
      })
      .where('ended', false)
      .whereNotDeleted()
      .withGraphFetched('[parent,responder,market]')
      .orderByRaw('random()')
      .limit(limit);
  }

  // Count how many verify type quest created by responder in the last 24 hours
  static async countVerifyQuests(responderId: string, txn?: Transaction): Promise<number> {
    return this.query(txn)
      .where('responderId', responderId)
      .where('type', 'verify')
      .where('createdAt', '>', moment().subtract(24, 'hours').toISOString())
      .count('id')
      .first()
      .then((res: any) => {
        return res.count;
      });
  }

  /**
   * Find record by name
   * @param name The target name
   * @param txn Optional transaction object
   * @returns
   */
  static findByName(name: string, txn?: Transaction) {
    return this.query(txn).where('name', 'ilike', name).whereNotDeleted().first();
  }

  // Find by type and name
  static findByTypeAndName(type: QuestType, name: string, txn?: Transaction) {
    return this.query(txn).where('type', type).where('name', name).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Quest>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  // Find quest where responder link begins with a string
  static findByTweetID(id: string, txn?: Transaction) {
    return this.query(txn).where('responderLink', 'ilike', `%${id}%`).whereNotDeleted().first();
  }
}

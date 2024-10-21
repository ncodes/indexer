import Objection, { Model, OrderByDirection, Transaction, raw } from 'objection';
import { isEqualStr, randStr } from '../common/common';
import { BaseModel } from './base';
import User from './user';

export enum PointAction {
  NFTOwnership = 'nft_ownership',
  NFTOwnershipRef = 'nft_ownership_ref',
  InstantSwap = 'instant_swap',
  InstantSwapRef = 'instant_swap_ref',
  InteractiveSwap = 'interactive_swap',
  InteractiveSwapRef = 'interactive_swap_ref',
  LiquidityAdd = 'liquidity_add',
  LiquidityAddRef = 'liquidity_add_ref',
  Generic = 'generic',
  GenericRef = 'generic_ref',
  CSV = 'csv',
  Energon = 'energon',
  TwitterConnect = 'twitter_connect',
  DiscordConnect = 'discord_connect',
  QuestBond = 'quest_bond',
  Quest = 'quest',
  QuestVote = 'quest_vote',
  TweetSearch = 'tweet_search_point',
  Tap = 'tap_score',
}

/**
 * Point represents a point
 */
export default class Point extends BaseModel {
  // The network name
  network: string;
  // A unique name for the point
  name: string;
  // The address of the point receiver
  address: string;
  // The referrer address that should benefit from this point.
  // Used to indicate the point is a referral point.
  referrer: string;
  // The referee who this point was derived from
  referee: string;
  // The point amount
  point: string;
  // The action that caused the point
  action: PointAction;
  // Whether the point is approved
  approved: boolean; // TODO: unsed, so remove
  // Whether the point is re-denominated
  redenominated: boolean;
  // Pre-redomination point
  oldPoint: string;
  // Whether the point is a trialnet point
  isTrialnet: boolean;

  // Not persisted
  owner: User;
  rank: number;

  constructor(init?: Partial<Point>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'point_' + randStr(24);
    if (this.isTrialnet == undefined) this.isTrialnet = true;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Point;
    object.object = 'point';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'points';
  }

  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: ['points.address'],
          to: ['users.address'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Point>, txn?: Transaction): Promise<Point> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Point>, txn?: Transaction): Promise<Point> {
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

  // get by address
  static getByAddress(address: string, txn?: Transaction) {
    return this.query(txn).where('address', 'ilike', address).whereNotDeleted().first();
  }

  // Delete point by name
  static deleteByName(name: string, txn?: Transaction) {
    return this.query(txn).where({ name }).whereNotDeleted().delete();
  }

  /**
   * getByName finds a record by name
   * @param name The record name
   * @param txn Optional transaction object
   * @returns
   */
  static getByName(name: string, txn?: Transaction) {
    return this.query(txn).where('name', 'ilike', name).whereNotDeleted().first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Point>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Get the top referees of a referrer
   * @param limit The limit of the leaderboard
   * @param referrer The referrer address
   * @param referee The referee address (optional)
   * @param txn Optional transaction object
   * @returns
   */
  static getTopRefereesOfReferrer(limit: number, referrer: string, referee?: string, txn?: Transaction) {
    return this.query(txn)
      .select('referee', 'referrer', 'address')
      .sum('point as totalPoints')
      .whereNotDeleted()
      .where('address', 'ilike', referrer)
      .where('referrer', 'ilike', referrer)
      .where((q) => {
        if (referee) {
          q.where('referee', 'ilike', referee);
        }
      })
      .groupBy('referee', 'address', 'referrer')
      .orderBy('totalPoints', 'desc')
      .limit(limit)
      .withGraphFetched('owner');
  }

  /**
   * Get the top addresses
   * @param limit The limit of the leaderboard
   * @param address The address (optional)
   * @param txn Optional transaction object
   * @returns
   */
  static getTopAddresses(limit: number, address?: string, txn?: Transaction) {
    return this.query(txn)
      .select('address')
      .sum('point as totalPoints')
      .whereNotDeleted()
      .where((q) => {
        if (address) {
          q.where('address', 'ilike', address);
        }
      })
      .groupBy('address')
      .orderBy('totalPoints', 'desc')
      .limit(limit)
      .withGraphFetched('owner');
  }

  /**
   * Get the distinct addresses
   * @param address The address (optional)
   * @param txn Optional transaction object
   * @returns
   */
  static async countDistinctAddresses(address?: string, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where((q) => {
        if (address) {
          q.where('address', 'ilike', address);
        }
      })
      .count(raw('DISTINCT address'))
      .first()
      .then((res: any) => {
        if (!res) return 0;
        return parseInt(res.count);
      });
  }

  /**
   * Count the distinct referees of a referrer
   * @param referrer The referrer address
   * @param referee The referee address (optional)
   * @param txn Optional transaction object
   * @returns
   */
  static async countDistinctRefereesOfReferrer(referrer: string, referee?: string, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where('referrer', 'ilike', referrer)
      .where('address', 'ilike', referrer)
      .where((q) => {
        if (referee) {
          q.where('referee', 'ilike', referee);
        }
      })
      .count(raw('DISTINCT referee'))
      .first()
      .then((res: any) => {
        if (!res) return 0;
        return parseInt(res.count);
      });
  }

  /**
   * Count the number of points for an address
   * @param address The address
   * @param txn Optional transaction object
   * @returns
   */
  static countByAddress(address: string, txn?: Transaction) {
    return this.query(txn)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .count('id')
      .first()
      .then((res: any) => {
        return res.count;
      });
  }

  /**
   * Get the rank of an address
   * @param address The address
   * @param txn Optional transaction object
   * @returns
   */
  static async getRankByAddress(address: string, txn?: Transaction) {
    const res = await this.query(txn)
      .select('address')
      .sum('point as totalPoints')
      .whereNotDeleted()
      .groupBy('address')
      .orderBy('totalPoints', 'desc');
    const rank = res.findIndex((r) => isEqualStr(r.address, address));
    return rank + 1;
  }

  // Get total points of address
  static async getTotalPointsByAddress(address: string, isTrialnet?: boolean, txn?: Transaction) {
    return this.query(txn)
      .where('address', 'ilike', address)
      .whereNot((q) => {
        if (isTrialnet != undefined) {
          return q.where({ isTrialnet });
        }
      })
      .whereNotDeleted()
      .sum('point as totalPoints')
      .first()
      .then((res: any) => {
        return res.totalPoints || '0';
      });
  }

  /**
   * Get the rank of an referee
   * @param referrer The referrer address
   * @param referee The referee address
   * @param txn Optional transaction object
   * @returns
   */
  static getRankOfReferrersReferee(referrer: string, referee: string, txn?: Transaction) {
    return this.query(txn)
      .select('referee', 'referrer', 'address')
      .sum('point as totalPoints')
      .whereNotDeleted()
      .where('address', 'ilike', referrer)
      .where('referrer', 'ilike', referrer)
      .groupBy('referee', 'address', 'referrer')
      .orderBy('totalPoints', 'desc')
      .then((res: any) => {
        const rank = res.findIndex((r) => isEqualStr(r.referee, referee));
        return rank + 1;
      });
  }

  /**
   * Get points created after a specific date and allow limit
   * @param date The date to start from
   * @param limit The maximum number of results to return
   * @param order The order of the results
   * @param txn Optional transaction object
   * @returns
   */
  static getPointsAfterDate(date: string, limit: number, order = 'asc', txn?: Transaction) {
    return this.query(txn)
      .where(raw('point::numeric > 0'))
      .where((q) => {
        if (date) q.where('createdAt', '>', date);
      })
      .whereNotDeleted()
      .limit(limit)
      .orderBy('createdAt', order as OrderByDirection);
  }

  /**
   * Get points created after a specific date and allow limit
   * @param date The date to start from
   * @param limit The maximum number of results to return
   * @param order The order of the results
   * @param txn Optional transaction object
   * @returns
   */
  static getReferrerPointsAfterDate(referrer: string, date: string, limit: number, order = 'asc', txn?: Transaction) {
    return this.query(txn)
      .where('referrer', 'ilike', referrer)
      .where('address', 'ilike', referrer)
      .where(raw('point::numeric > 0'))
      .where((q) => {
        if (date) q.where('createdAt', '>', date);
      })
      .whereNotDeleted()
      .limit(limit)
      .orderBy('createdAt', order as OrderByDirection);
  }

  /**
   * Get total points by referrer
   * @param referrer The referrer address
   * @param txn Optional transaction object
   * @returns
   */
  static async getReferrerTotalPoints(referrer: string, txn?: Transaction) {
    return this.query(txn)
      .where('referrer', 'ilike', referrer)
      .where('address', 'ilike', referrer)
      .whereNotDeleted()
      .sum('point as totalPoints')
      .first()
      .then((res: any) => {
        return res.totalPoints || '0';
      });
  }

  /**
   * Get non-redenominated points
   * @param limit The limit of the results
   * @param txn Optional transaction object
   * @returns
   */
  static getNonRedominatedPoints(limit = 100, txn?: Transaction) {
    return this.query(txn).where('redenominated', false).where('isTrialnet', false).whereNotDeleted().limit(limit);
  }
}

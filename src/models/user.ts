import Objection, { Model, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import NotificationSetting from './notification_setting';

/**
 * User represents a user model
 */
export default class User extends BaseModel {
  email: string;
  emailUnverified: string;
  address: string;
  locale: string;
  timezone: string;
  role: string;
  deviceTokenEmail: string;
  otpSecret: string;
  referrer: string;
  refCode: string;
  messagingEnabled: boolean;
  twitterUserId: string;
  twitterUsername: string;
  twitterToken: string;
  twitterLinkedAt: string;
  discordId: string;
  discordToken: string;
  discordLinkedAt: string;
  isEarlyDiscordMember: boolean;
  presale: boolean;
  presaleCountry: string;
  ipCountry: string;
  presaleApproved: boolean;
  curBattleId: string;
  battleSide: 'droid' | 'bandit';

  // Not persisted
  totalUnclaimedAlloc: string;
  points: number;
  pointsAllocs: number;
  pointsAllocsClaimed: boolean;
  totalSwaps: number;
  completionRate: number;
  badges: string[];
  volume: string;
  volumeUsd: number;
  lastActiveAt: string;
  notificationSettings: Partial<NotificationSetting>;
  nft: { count?: number; totalAlloc?: number; claimed?: boolean };
  earlyDiscordMemberAlloc: string;
  earlyDiscordMemberClaimed: boolean;

  constructor(init?: Partial<User>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'user_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const user = super.$formatJson(json) as User;
    user.object = 'user';
    delete user.otpSecret;
    delete user.deviceTokenEmail;
    delete user.twitterToken;
    delete user.ipCountry;
    delete user.presaleCountry;
    return user;
  }

  desensitize() {
    delete this.email;
    delete this.role;
    return this;
  }

  static get tableName() {
    return 'users';
  }

  static get relationMappings() {
    return {
      notificationSettings: {
        relation: Model.HasOneRelation,
        modelClass: NotificationSetting,
        join: {
          from: 'users.id',
          to: 'notification_settings.userId',
        },
      },
    };
  }

  /**
   * create creates a user
   * @param data The transfer info
   */
  static create(data: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      return this.query().insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a user by ID
   * @param id The user id
   * @
   */
  static getById(id: string, relations = 'notificationSettings') {
    return this.query().whereNotDeleted().withGraphFetched(relations).findById(id);
  }

  /**
   * getByEmail finds a user by their email address
   * @param email The user's email address
   * @param txn Optional transaction object
   */
  static getByEmail(email: string, txn?: Transaction) {
    return this.query(txn)
      .where('email', 'ILIKE', email)
      .whereNotDeleted()
      .withGraphFetched('notificationSettings')
      .first();
  }

  /**
   * Get a user by device token
   * @param token
   * @param txn
   * @returns
   */
  static async getByDeviceToken(token: string, txn?: Transaction): Promise<User> {
    return this.query(txn)
      .where('deviceTokenEmail', token)
      .whereNotDeleted()
      .withGraphFetched('notificationSettings')
      .first();
  }

  /**
   * getByAddress finds a user by their address
   * @param address The user's address
   * @param txn Optional transaction object
   */
  static getByAddress(address: string, txn?: Transaction) {
    return this.query(txn)
      .where('address', 'ILIKE', address)
      .whereNotDeleted()
      .withGraphFetched('notificationSettings')
      .first();
  }

  /**
   * Get a user by ref code
   * @param refCode The referrer code
   * @param txn Optional transaction object
   * @returns
   */
  static getByRefCode(refCode: string, txn?: Transaction) {
    return this.query(txn)
      .select('address')
      .where('refCode', 'ILIKE', refCode)
      .whereNotDeleted()
      .withGraphFetched('notificationSettings')
      .first();
  }

  /**
   * Get a user by discord ID
   * @param discordId The discord ID
   * @param txn Optional transaction object
   * @returns
   */
  static getByDiscordId(discordId: string, txn?: Transaction) {
    return this.query(txn)
      .where('discordId', 'ILIKE', discordId)
      .whereNotDeleted()
      .withGraphFetched('notificationSettings')
      .first();
  }

  /**
   * Get a user by twitter username
   * @param username The twitter username
   */
  static getByTwitterUsername(username: string) {
    return this.query().where('twitterUsername', 'ILIKE', username).whereNotDeleted().first();
  }

  /**
   * Get a user by twitter user ID
   * @param userId The twitter user ID
   */
  static getByTwitterUserId(userId: string) {
    return this.query().where('twitterUserId', 'ILIKE', userId).whereNotDeleted().first();
  }

  /**
   * find finds a user
   * @param q the query parameter
   */
  static find(q: Partial<User>) {
    return this.query().where(q).whereNotDeleted().first();
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   */
  static count(q: Partial<User>) {
    return new Promise<string>((resolve, reject) => {
      this.query()
        .where(q)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * updateById updates a user by ID
   * @param id the user id
   * @param udp the fields to be updated
   */
  static updateById(id: string, udp: Partial<User>) {
    return this.query().whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * updateByAddress updates a user by address
   * @param address the user address
   * @param udp the fields to be updated
   */
  static updateByAddress(address: string, udp: Partial<User>) {
    return this.query().where('address', 'ILIKE', address).whereNotDeleted().patch(udp);
  }

  /**
   * Count the number of users referred by an address
   * @param address The address of the referrer
   */
  static async countReferred(address: string) {
    return this.query()
      .where('referrer', 'ilike', address)
      .where((q) => {
        return q.whereRaw('"twitterUserId" is not null').orWhereRaw('"discordId" is not null');
      })
      .whereNotDeleted()
      .count('id')
      .first()
      .then((res: any) => {
        return parseInt(res.count);
      });
  }

  /**
   * Get the addresses referred by an address
   * @param address The address of the referrer
   * @param limit The limit of addresses to get
   * @param txn Optional transaction object
   */
  static getReferred(address: string, limit: number, txn?: Transaction) {
    return this.query(txn)
      .where('referrer', 'ilike', address)
      .where((q) => {
        return q.whereRaw('"twitterUserId" is not null').orWhereRaw('"discordId" is not null');
      })
      .whereNotDeleted()
      .select('address')
      .limit(limit);
  }

  // Get recent n referrees of a referrer
  static getRecentReferred(address: string, limit: number) {
    return this.query()
      .where('referrer', 'ilike', address)
      .where((q) => {
        return q.whereRaw('"twitterUserId" is not null').orWhereRaw('"discordId" is not null');
      })
      .whereNotDeleted()
      .select('address', 'createdAt')
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  /**
   * Count users belonging to a side in the given battle
   * @param battleId The battle ID
   * @param side The side to count
   * @returns
   */
  static async countBattleSide(battleId: string, side: 'droid' | 'bandit') {
    return this.query()
      .where('curBattleId', battleId)
      .where('battleSide', side)
      .whereNotDeleted()
      .count('id')
      .first()
      .then((res: any) => {
        return parseInt(res.count || '0');
      });
  }
}

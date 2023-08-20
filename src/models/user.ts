import { randStr } from "../common/common";
import Objection, { Transaction } from "objection";
import { BaseModel } from "./base";

/**
 * User represents a user model
 */
export default class User extends BaseModel {
  email: string;
  address: string;
  locale: string;
  timezone: string;
  role: string;

  totalSwaps: number;
  completionRate: number;
  badges: string[];
  volume: string;
  volumeUsd: number;
  lastActiveAt: string;

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
    return {};
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
   */
  static getById(id: string) {
    return this.query().whereNotDeleted().findById(id);
  }

  /**
   * getByEmail finds a user by their email address
   * @param email The user's email address
   * @param txn Optional transaction object
   */
  static getByEmail(email: string, txn?: Transaction): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query(txn).where('email', 'ILIKE', email).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * getByAddress finds a user by their address
   * @param address The user's address
   * @param txn Optional transaction object
   */
  static getByAddress(address: string, txn?: Transaction): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query(txn).where('address', 'ILIKE', address).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find finds a user
   * @param q the query parameter
   */
  static find(q: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query().where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
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
}

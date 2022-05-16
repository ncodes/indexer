import * as crand from 'crypto-random-string';
import Objection from 'objection';
import { Roles } from '../common/roles';
import { BaseModel } from './base';

/**
 * User represents a user model
 */
export default class User extends BaseModel {
  // The email of the user
  email: string;
  // The user's role
  role: string;

  constructor(init?: Partial<User>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'user_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const user = super.$formatJson(json) as User;
    user.object = 'user';
    return user;
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
   * getById finds a user by Id
   * @param id The user id
   */
  static getById(id: string): Promise<User> {
    return this.query().whereNotDeleted().findById(id);
  }

  /**
   * getByEmail finds a user by their email address
   * @param email The user's email address
   */
  static getByEmail(email: string): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query()
        .where('email', 'ILIKE', email)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * find finds a user
   * @param q the query parameter
   */
  static find(q: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query()
        .where(q)
        .whereNotDeleted()
        .first()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * findAll finds all users
   * @param q the query parameter
   */
  static findAll(q: Partial<User>): Promise<User[]> {
    return new Promise((resolve, reject) => {
      this.query().where(q).whereNotDeleted().then(resolve).catch(reject);
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
  static updateById(id: string, udp: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      this.query()
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  isAdmin() {
    return this.role === Roles.Admin;
  }
}

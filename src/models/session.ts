import * as crand from 'crypto-random-string';
import Objection, { Model } from 'objection';
import { BaseModel } from './base';
import User from './user';

/**
 * Session represents a user's login session.
 */
export default class Session extends BaseModel {
  active: boolean;
  userId: string;

  static get tableName() {
    return 'sessions';
  }

  owner: User;
  static get relationMappings() {
    return {
      owner: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'sessions.userId',
          to: 'users.id',
        },
      },
    };
  }

  /**
   * getById finds a user by Id
   * @param id The user id
   */
  static getById(id: string): Promise<Session> {
    return this.query()
      .whereNotDeleted()
      .findById(id)
      .withGraphFetched('owner.wallets');
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'session_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    json = super.$formatJson(json);
    json.object = 'session';
    delete json.password;
    return json;
  }

  /**
   * create a session for a user
   * @param userId The user ID
   */
  static create(userId: string): Promise<Session> {
    return new Promise((resolve, reject) => {
      this.query()
        .insert({
          userId,
          active: true,
        })
        .then(resolve)
        .catch(reject);
    });
  }
}

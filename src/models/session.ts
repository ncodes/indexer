import * as crand from 'crypto-random-string';
import Objection, { Model } from 'objection';
import { BaseModel } from './base';
import User from './user';

/**
 * Session represents a user's login session.
 */
export default class Session extends BaseModel {
  userId: string;
  signature: string;

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
   * getById finds a record by Id
   * @param id The user id
   */
  static getById(id: string): Promise<Session> {
    return this.query().whereNotDeleted().findById(id).withGraphFetched('owner(notDeleted)');
  }

  /**
   * getBySignature finds a record by signature
   * @param signature The target signature
   */
  static getBySignature(signature: string): Promise<Session> {
    return this.query()
      .where({ signature })
      .whereNotDeleted()
      .withGraphFetched('owner(notDeleted)')
      .first();
  }

  /**
   * create a session for a user
   * @param userId The user ID
   * @param signature The auth signature
   */
  static create(userId: string, signature: string): Promise<Session> {
    return new Promise((resolve, reject) => {
      this.query()
        .insert({
          userId,
          signature,
        })
        .then(resolve)
        .catch(reject);
    });
  }
}

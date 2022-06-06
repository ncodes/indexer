import { BaseModel } from './base';

/**
 * Meta represents key and value pair.
 */
export default class Meta extends BaseModel {
  key: string;
  value: string;

  constructor(init?: Partial<Meta>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'meta';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * get finds a record by key
   * @param key The target key
   */
  static get(key: string): Promise<Meta> {
    return this.query().where({ key }).first();
  }

  /**
   * create a session for a user
   * @param key The meta key
   * @param value The meta value
   */
  static create(key: string, value: string): Promise<Meta> {
    return new Promise((resolve, reject) => {
      this.query()
        .insert({
          key,
          value,
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * update updates a user by ID
   * @param key The target key
   * @param value The target value
   */
  static update(key: string, value: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const existing = await this.get(key);
        if (!existing) {
          await this.query().insert({ key, value });
          return resolve();
        }
        await this.query().where({ id: existing.id }).patch({ value });
        return resolve();
      } catch (e) {
        return reject(e);
      }
    });
  }
}

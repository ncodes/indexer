import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

export const defaultNotificationSettings = {
  disabled: false,
  disabledOffer: false,
  disabledSwap: false,
  disabledLiq: false,
};

/**
 * NotificationSetting represents notification settings
 */
export default class NotificationSetting extends BaseModel {
  userId: string;
  resource: string;
  disabled: boolean;
  disabledSwap: boolean;
  disabledLiq: boolean;
  disabledOffer: boolean;

  constructor(init?: Partial<NotificationSetting>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'notif_set_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as NotificationSetting;
    object.object = 'notif_set';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'notification_settings';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<NotificationSetting>, txn?: Transaction): Promise<NotificationSetting> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<NotificationSetting>, txn?: Transaction): Promise<NotificationSetting> {
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
   * getByUserId finds a record by user ID
   * @param userId The user ID
   * @param txn Optional transaction object
   */
  static getByUserId(userId: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('userId', userId).first();
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<NotificationSetting>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }
}

import * as crand from 'crypto-random-string';
import Objection, { Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * InvitedMediator represents an invited mediator
 */
export default class InvitedMediator extends BaseModel {
  // The network name
  network: string;
  // The market ID
  marketId: string;
  // The invited account address
  address: string;
  // Indicates whether the invite is accepted
  accepted: boolean;

  constructor(init?: Partial<InvitedMediator>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'invited_mediator_' + crand({ length: 24 });
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = super.$formatJson(json) as InvitedMediator;
    object.object = 'invited_mediator';
    return object;
  }

  static get tableName() {
    return 'invited_mediators';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<InvitedMediator>, txn?: Transaction): Promise<InvitedMediator> {
    return new Promise(async (resolve, reject) => {
      const softDeleted = await this.query(txn).where(data).whereDeleted().first();
      if (softDeleted) {
        await this.query(txn)
          .where('id', softDeleted.id)
          .patch({ accepted: false, deletedAt: null });
        delete softDeleted.deletedAt;
        return resolve(softDeleted);
      }

      return this.query(txn).insert(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<InvitedMediator>, txn?: Transaction): Promise<InvitedMediator> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find an invitation
   * @param network The network name
   * @param marketId The market ID
   * @param address The invited address
   * @param txn Optional transaction object
   */
  static findInvite(network: string, marketId: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .first();
  }

  /**
   * updateInvite updates an invitation
   * @param network The network name
   * @param marketId The market ID
   * @param address The invited address
   * @param upd The proposed update
   * @param txn Optional transaction object
   */
  static updateInvite(
    network: string,
    marketId: string,
    address: string,
    upd: Partial<InvitedMediator>,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .patch(upd);
  }

  /**
   * removeInvite remove an invite
   * @param network The network name
   * @param marketId The market ID
   * @param address The invited address
   * @param txn Optional transaction object
   */
  static removeInvite(network: string, marketId: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .delete();
  }
}

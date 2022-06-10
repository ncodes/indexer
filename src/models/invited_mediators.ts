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
    const object = json as InvitedMediator;
    object.object = 'invited_mediator';
    delete object.deletedAt;
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
   * findInviteNetworkMarketIDAndAddress an invitation
   * @param network The network name
   * @param marketId The market ID
   * @param address The invited address
   * @param txn Optional transaction object
   */
  static findInviteByNetworkMarketIDAndAddress(
    network: string,
    marketId: string,
    address: string,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .whereNotDeleted()
      .first();
  }

  /**
   * searchByNetworkMarketID searches for invitations by network and market ID
   * @param network The network name
   * @param marketId The market ID
   * @param acceptedOnly When set, returns only accepted or unaccepted records
   * @param limit The result limit
   * @param prevSerial The last serial number seen (for pagination)
   * @param txn Optional transaction object
   */
  static searchByNetworkMarketID(
    network: string,
    marketId: string,
    acceptedOnly: boolean,
    limit: number,
    prevSerial: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn).where('network', 'ILIKE', network);
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    if (prevSerial) q = q.where('sn', '<', prevSerial);
    if (limit) q = q.limit(limit);
    if (acceptedOnly !== undefined) q = q.where({ accepted: acceptedOnly });
    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
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
   * remove an invitation
   * @param network The network name
   * @param marketId The market ID
   * @param address The invited address
   * @param txn Optional transaction object
   */
  static remove(network: string, marketId: string, address: string, txn?: Transaction) {
    return this.query(txn)
      .where('network', 'ilike', network)
      .where('marketId', 'ilike', marketId)
      .where('address', 'ilike', address)
      .delete();
  }
}

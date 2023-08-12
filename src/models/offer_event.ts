import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import { uniq } from 'lodash';

export enum OfferEventAction {
  Create = 'create',
  Update = 'update',
  Accept = 'accept',
  Unaccept = 'unaccept',
  Cancel = 'cancel',
  Execute = 'execute',
}

/**
 * OfferEvent represents an offer event
 */
export default class OfferEvent extends BaseModel {
  // The network name
  network: string = undefined;
  // The on-chain offer ID
  offerId: number;
  // The offer event creator
  creator: string = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The price of the liquidity
  price: string = undefined;
  // The NFT IDs to offer for the liquidity
  ids: number[] = undefined;
  // The offer event action
  action: OfferEventAction = undefined;

  constructor(init?: Partial<OfferEvent>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'offer_event_' + randStr(24);
    this.ids = this.ids ? (JSON.stringify(this.ids) as any) : this.ids;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.ids = JSON.stringify(this.ids) as any;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as OfferEvent;
    object.object = 'offer_event';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'offer_events';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<OfferEvent>, txn?: Transaction): Promise<OfferEvent> {
    return new Promise((resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
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

  // Get by offer ID
  static getByOfferId(offerId: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where({ offerId });
  }
}

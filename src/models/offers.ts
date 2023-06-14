import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';

/**
 * Offer represents an offer request for a liquidity
 */
export default class Offer extends BaseModel {
  // The network where the offer was created
  network: string = undefined;
  // The market address
  marketAddress: string = undefined;
  // The provider address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
  // The on-chain offer ID
  offerId: number;
  // The offer creator's address
  creator: string = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The price of the liquidity
  price: string = undefined;
  // The NFT IDs to offer for the liquidity
  ids: number[] = undefined;
  // Indicates if the offer was accepted
  accepted: boolean = undefined;
  // Indicates if the offer was cancelled
  cancelled: boolean = undefined;
  // Indicates if the offer was executed
  executed: boolean = undefined;
  // The offer execution date
  execAt: string = undefined;
  // The offer expiration date
  deadline: string = undefined;

  constructor(init?: Partial<Offer>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'offer_' + randStr(24);
    this.ids = this.ids ? (JSON.stringify(this.ids) as any) : this.ids;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.ids = JSON.stringify(this.ids) as any;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Offer;
    object.object = 'offer';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'offers';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Offer>, txn?: Transaction): Promise<Offer> {
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

  /**
   * getByOfferId finds an offer its on-chain ID
   * @param id The on-chain id
   * @param txn Optional transaction object
   */
  static getByOfferId(id: number, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('offerId', id).first();
  }

  /**
   * updateByOfferId updates a record by on-chain offer ID
   * @param id The on-chain offer id
   * @param udp The fields to be updated
   * @param txn Optional transaction object
   */
  static async updateByOfferId(id: number, udp: Partial<Offer>, txn?: Transaction) {
    await this.query(txn).whereNotDeleted().where('offerId', id).patch(udp);
    return this.query(txn).whereNotDeleted().where('offerId', id).first();
  }
}

import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import { uniq } from 'lodash';

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
   * Find an offer by its network name and on-chain ID
   * @param network The network name
   * @param id The on-chain id
   * @param select The fields to be selected
   * @param txn Optional transaction object
   */
  static getByNetworkAndOfferId(network: string, id: number, select = [], txn?: Transaction) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .whereNotDeleted()
      .select(...select)
      .where('network', network)
      .where('offerId', id)
      .first();
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

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Offer()).includes(x));
    select = select.length
      ? uniq(select.concat(['id', 'marketAddress', 'network', 'creator', 'offerId', 'provider', 'lid']))
      : ['*'];
    return select;
  }

  /**
   * search for offers
   * @param network The network name
   * @param creator The market creator address
   * @param marketAddress The market address to filter by
   * @param provider The provider address to filter by
   * @param lid The liquidity ID to filter by
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param txn Optional transaction object
   */
  static search(
    network?: string,
    creator?: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
    countOnly?: boolean,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let query = this.query(txn);
    query = !countOnly ? query.select(...select, raw('count(*) over() as' + ' "__queryCount"')) : query;
    if (network) query = query.where('network', 'ilike', network);
    if (creator) query = query.where('creator', 'ilike', creator);
    if (provider) query = query.where('provider', 'ilike', provider);
    if (lid) query = query.where('lid', lid);
    if (marketAddress) query = query.where('marketAddress', 'ilike', marketAddress);
    if (countOnly) {
      return query
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.whereNotDeleted().orderBy('updatedAt', 'DESC');
  }
}

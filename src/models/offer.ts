import { randStr } from '../common/common';
import Objection, { Model, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import { uniq } from 'lodash';
import * as moment from 'moment';
import Market from './market';
import Liquidity from './liquidity';

export enum SearchStatus {
  Accepted = 'accepted',
  Cancelled = 'cancelled',
  Executed = 'executed',
  Expired = 'expired',
}

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

  /** Non-persisted fields */
  priceUsd: number;
  amountUsd: number;

  /** Relations */
  market: Market;
  liquidity: Liquidity;

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
    return {
      market: {
        relation: Model.BelongsToOneRelation,
        modelClass: Market,
        join: {
          from: ['offers.network', 'offers.marketAddress'],
          to: ['markets.network', 'markets.address'],
        },
      },
      liquidity: {
        relation: Model.BelongsToOneRelation,
        modelClass: Liquidity,
        join: {
          from: ['offers.network', 'offers.provider', 'offers.lid'],
          to: ['liquidities.network', 'liquidities.provider', 'liquidities.lid'],
        },
      },
    };
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
   * @param relations The relations to be fetched
   * @param txn Optional transaction object
   */
  static getByNetworkAndOfferId(network: string, id: number, select = [], relations: string, txn?: Transaction) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .whereNotDeleted()
      .select(...select)
      .where('network', network)
      .where('offerId', id)
      .withGraphFetched(relations)
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
   * @param creatorOrProvider Filter by offer creator or provider
   * @param lid The liquidity ID to filter by
   * @param status The offer status to filter by
   * @param fromDate The start date to filter by (optional)
   * @param toDate The end date to filter by (optional)
   * @param status The swap status (optional)
   * @param countOnly Indicates whether to return count only.
   * @param limit The number of records to return.
   * @param offset The offset value
   * @param select Select specific fields
   * @param relations
   * @param txn Optional transaction object
   */
  static async search(
    network: string,
    creator: string,
    provider: string,
    creatorOrProvider: string,
    marketAddress: string,
    lid: number,
    status: SearchStatus,
    fromDate: string,
    toDate: string,
    countOnly: boolean,
    limit: number,
    offset: number,
    select = [],
    relations: string,
    txn?: Objection.Transaction,
  ) {
    select = this.makeSelectList(select);
    let query = this.query(txn);
    query = !countOnly ? query.select(...select, raw('count(*) over() as' + ' "$queryCount"')) : query;
    if (network) query = query.where('network', 'ilike', network);
    if (creator) query = query.where('creator', 'ilike', creator);
    if (marketAddress) query = query.where('marketAddress', 'ilike', marketAddress);
    if (provider) query = query.where('provider', 'ilike', provider);
    if (lid) query = query.where('lid', lid);

    if (creatorOrProvider) {
      query = query.where((qb) => {
        return qb.where('creator', 'ilike', creatorOrProvider).orWhere('provider', 'ilike', creatorOrProvider);
      });
    }

    if (status) {
      switch (status) {
        case SearchStatus.Accepted:
          query = query.where('accepted', true);
          break;
        case SearchStatus.Cancelled:
          query = query.where('cancelled', true);
          break;
        case SearchStatus.Executed:
          query = query.where('executed', true);
          break;
        case SearchStatus.Expired:
          query = query.where('deadline', '<', moment().toISOString());
          break;
      }
    }

    if (fromDate) query = query.where('createdAt', '>=', fromDate);

    if (toDate) query = query.where('createdAt', '<=', toDate);

    if (countOnly) {
      const res = await query.count('id').first();
      return res.count;
    }

    if (offset != undefined) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.withGraphFetched(relations).whereNotDeleted().orderBy('updatedAt', 'DESC');
  }
}

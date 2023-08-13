import { randStr } from '../common/common';
import Objection, { Model, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import * as _ from 'lodash';
import Draft from './draft';
import Swap from './swap';

/**
 * Dispute represents a swap dispute
 */
export default class Dispute extends BaseModel {
  // The network name
  network: string = undefined;
  // The creator of the dispute
  creator: string = undefined;
  // The defendant of the dispute
  defendant: string = undefined;
  // The market ID joined
  marketAddress: string = undefined;
  // The order index
  orderId: number = undefined;
  // The dispute index
  disputeId: number = undefined;
  // The number of mediators required
  numMediators: number = undefined;
  // The number of mediators drafted
  numMediatorsDrafted: number = undefined;
  // Indicates the creator's preferred outcome
  wantRelease: boolean = undefined;
  // Indicates whether this dispute was re-disputed
  redispute: boolean = undefined;
  // The evidence submission expiry time
  evidenceEndAt: string = undefined;
  // The vote commit end time
  commitEndAt: string = undefined;
  // The vote reveal end time
  revealEndAt: string = undefined;
  // The voting end time
  predictEndAt: string = undefined;
  // Indicates whether the dispute has been executed
  executed: boolean = undefined;
  // Indicates whether the dispute outcome was release or cancelled
  released: boolean = undefined;
  // Indicates the dispute was abandoned
  abandoned: boolean = undefined;
  // Indicates the order was released before dispute execution
  orderReleased: boolean = undefined;
  // Notification marker for `evidenceEndAt`
  notifiedOnEvidenceEndAt: boolean = undefined;
  // Notification marker for `commitEndAt
  notifiedOnCommitEndAt: boolean = undefined;
  // Notification marker for `revealEndAt`
  notifiedOnRevealEndAt: boolean = undefined;

  /** Relations */
  draftees: Draft[];
  swap: Swap;

  constructor(init?: Partial<Dispute>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'dispute_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Dispute;
    object.object = 'dispute';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'disputes';
  }

  static get relationMappings() {
    return {
      draftees: {
        relation: Model.HasManyRelation,
        modelClass: Draft,
        join: {
          from: 'drafts.disputeId',
          to: 'disputes.id',
        },
      },
      swap: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: ['disputes.network', 'disputes.orderId'],
          to: ['swaps.network', 'swaps.orderId'],
        },
      },
    };
  }

  /**
   *
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Dispute>, txn?: Transaction): Promise<Dispute> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Dispute>, txn?: Transaction) {
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
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Dispute>, txn?: Transaction): Promise<Dispute> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * countByNetworkAndMarketId counts dispute associated with a market order
   * @param network The network name
   * @param marketAddress The marker ID
   * @param orderId The order ID
   * @param txn Optional transaction object
   */
  static countByNetworkAndMarketIdAndOrderId(
    network: string,
    marketAddress: string,
    orderId: number,
    txn?: Transaction,
  ) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .where({ network, orderId })
        .where('marketAddress', 'ilike', marketAddress)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(parseInt(res.count));
        })
        .catch(reject);
    });
  }

  /**
   * Get a specific dispute
   * @param network The network name
   * @param marketAddress The marker ID
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param txn Optional transaction object
   */
  static get(network: string, marketAddress: string, orderId: number, disputeId: number, txn?: Transaction) {
    return this.query(txn)
      .where({ network, orderId, disputeId })
      .where('marketAddress', 'ilike', marketAddress)
      .whereNotDeleted()
      .first();
  }

  /**
   * Get a recently created dispute of an order
   * @param network The network name
   * @param marketAddress The marker ID
   * @param orderId The order ID
   * @param txn Optional transaction object
   */
  static getRecentOfOrder(network: string, marketAddress: string, orderId: number, txn?: Transaction) {
    return this.query(txn)
      .where({ network, orderId })
      .where('marketAddress', 'ilike', marketAddress)
      .orderBy('disputeId', 'DESC')
      .whereNotDeleted()
      .first();
  }

  /**
   * Get disputes that have passed their evidenceEndAt date but have not
   * had notifications sent.
   * @param limit The number of disputes to return
   * @param txn Optional transaction object
   */
  static getByAfterEvidenceEndAt(limit = 100, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where('evidenceEndAt', 'is not', null)
      .where('evidenceEndAt', '<=', 'now()')
      .where({
        notifiedOnEvidenceEndAt: false,
        orderReleased: false,
        executed: false,
        released: false,
        abandoned: false,
      })
      .limit(limit);
  }

  /**
   * Get disputes that have passed their commitEndAt date but have not had
   * notifications sent.
   * @param limit The number of disputes to return
   * @param txn Optional transaction object
   */
  static getByAfterCommitEndAt(limit = 100, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where('commitEndAt', 'is not', null)
      .where('commitEndAt', '<=', 'now()')
      .where({
        notifiedOnCommitEndAt: false,
        orderReleased: false,
        executed: false,
        released: false,
        abandoned: false,
      })
      .limit(limit);
  }

  /**
   * Get disputes that have passed their revealEndAt date but have not had
   * notifications sent.
   * @param limit The number of disputes to return
   * @param txn Optional transaction object
   */
  static getByAfterRevealEndAt(limit = 100, txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where('revealEndAt', 'is not', null)
      .where('revealEndAt', '<=', 'now()')
      .where({
        notifiedOnRevealEndAt: false,
        orderReleased: false,
        executed: false,
        released: false,
        abandoned: false,
      })
      .limit(limit);
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Dispute()).includes(x));
    select = select.length
      ? _.uniq(select.concat(['id', 'marketAddress', 'network', 'creator', 'disputeId', 'orderId', 'defendant']))
      : ['*'];
    return select;
  }

  /**
   * searchDisputes finds disputes
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param creator Indicate to return dispute by the given dispute creator
   * @param defendant Indicate to return dispute by the given defendant
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param redispute Indicate to filter by re-dispute status
   * @param executed Indicate to filter by executed disputes
   * @param released Indicate to filter by released disputes
   * @param abandoned Indicate to filter by abandoned disputes
   * @param orderReleased Indicate to filter by dispute with released swap order
   * @param countOnly Indicate to return count only
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static async search(
    network: string,
    marketAddress?: string,
    creator?: string,
    defendant?: string,
    orderId?: number,
    disputeId?: number,
    redispute?: boolean,
    executed?: boolean,
    released?: boolean,
    abandoned?: boolean,
    orderReleased?: boolean,
    countOnly?: boolean,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn);
    q = !countOnly ? q.select(...select, raw('count(*) over() as' + ' "$queryCount"')) : q;
    q = q.withGraphFetched('[draftees,swap]').whereNotDeleted().where({ network });
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
    if (creator) q = q.where('creator', 'ILIKE', creator);
    if (defendant) q = q.where('defendant', 'ILIKE', defendant);
    if (orderId) q = q.where('orderId', orderId);
    if (disputeId) q = q.where('disputeId', disputeId);
    if (redispute !== undefined) q = q.where('redispute', redispute);
    if (executed !== undefined) q = q.where('executed', executed);
    if (released !== undefined) q = q.where('released', released);
    if (abandoned !== undefined) q = q.where('abandoned', abandoned);
    if (orderReleased !== undefined) q = q.where('orderReleased', orderReleased);
    if (countOnly) {
      const res = await q.count('id').first();
      return res.count;
    }
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }
}

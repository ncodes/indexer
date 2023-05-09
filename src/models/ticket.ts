import { randStr } from '../common/common';
import Objection, { raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Market from './market';
import * as _ from 'lodash';

/**
 * Ticket represents a mediation ticket
 *
 * @Note The fields are initialized with undefined so that Object.keys can
 * return the fields. Removing this will cause issues in query methods calling
 * Object.keys on the class to learn about model fields.
 */
export default class Ticket extends BaseModel {
  // The network name
  network: string = undefined;
  // The owner of the ticket
  owner: string = undefined;
  // The index of the ticket
  index: number = undefined;
  // The market ID joined
  marketId: string = undefined;
  // The swap order ID drafted to
  orderId: number = undefined;
  // The dispute ID
  disputeId: number = undefined;
  // The address of the delegate
  delegate: string = undefined;
  // Indicates whether the ticket is a delegate ticket
  delegated: boolean = undefined;
  // The amount held as bond
  bond: string = undefined;
  // When the ticket becomes matured
  matureAt: string = undefined;
  // When the ticket is expected to have joined a market or become expired
  joinBy: string = undefined;
  // The transaction hash
  txHash: string = undefined;
  // Indicates the ticket bond has been drained (ticket becomes expired)
  drained: boolean = undefined;
  // Indicate whether the ticket has been drafted
  drafted: boolean = undefined;
  // Indicate whether the ticket has been slashed
  slashed: boolean = undefined;
  // The time when the ticket can leave the market
  leaveAt: string = undefined;
  // The time when the ticket is considered cancelled
  cancelAt: string = undefined;
  // The time the ticket was drained
  drainedAt: string = undefined;
  // The time the ticket was drafted
  draftedAt: string = undefined;

  /** Not Persisted */
  market: Market;

  matured: boolean;
  expired: boolean;
  cancelling: boolean;
  cancelled: boolean;
  canLeave: boolean;

  constructor(init?: Partial<Ticket>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'ticket_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Ticket;
    object.object = 'ticket';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'tickets';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Ticket>, txn?: Transaction): Promise<Ticket> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Ticket>, txn?: Transaction): Promise<Ticket> {
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
   * getById finds a record by ID
   * @param network The network name
   * @param owner The owner of the ticket
   * @param index The ticket index
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static getByNetworkOwnerAndIndex(
    network: string,
    owner: string,
    index: number,
    select = [],
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .select(...select)
      .whereNotDeleted();
    if (index) q = q.where({ index });
    if (network) q = q.where({ network });
    if (owner) q = q.where('owner', 'ilike', owner);
    return q.first();
  }

  /**
   * updateById updates a notification by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Ticket>, txn?: Transaction) {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .whereNotDeleted()
        .patchAndFetchById(id, udp)
        .execute()
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param network The network name
   * @param marketId The marker ID
   * @param txn Optional transaction object
   */
  static countByNetworkAndMarket(network: string, marketId: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where({ network })
        .where('marketId', 'ilike', marketId)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Ticket()).includes(x));
    select = select.length
      ? _.uniq(select.concat(['id', 'marketId', 'network', 'owner', 'index', 'orderId']))
      : ['*'];
    return select;
  }

  /**
   * searchTickets finds tickets
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param owner Indicate to return ticket with matching owner
   * @param delegate Indicate to return ticket with matching delegate
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param joined Indicate to return tickets (un)joined  to a market
   * @param matured Indicate to return matured tickets
   * @param drafted Indicate to return draft or undrafted tickets
   * @param expired Indicate to return only expired tickets
   * @param cancelled Indicate to return only cancelled tickets
   * @param slashed Indicate to return only slashed tickets
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param txn Optional transaction object
   */
  static searchTickets(
    network: string,
    marketId?: string,
    owner?: string,
    delegate?: string,
    orderId?: number,
    disputeId?: number,
    joined?: boolean,
    matured?: boolean,
    drafted?: boolean,
    expired?: boolean,
    cancelled?: boolean,
    slashed?: boolean,
    limit?: number,
    offset?: number,
    select = [],
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .select(...select, raw('count(*) over() as' + ' "__queryCount"'))
      .whereNotDeleted()
      .where({ network });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    q = q.where((q) => {
      if (owner && !delegate) q = q.where('owner', 'ILIKE', owner);
      if (delegate && !owner) q = q.where('delegate', 'ILIKE', delegate);
      if (owner && delegate)
        q.where('owner', 'ILIKE', owner).orWhere('delegate', 'ILIKE', delegate);
    });
    if (orderId !== undefined) q = q.where('orderId', orderId);
    if (disputeId !== undefined) q = q.where('disputeId', disputeId);
    if (joined !== undefined) {
      q = q.where((q) => {
        if (joined) q.orWhere('marketId', 'is not', null);
        else q.orWhere('marketId', 'is', null);
      });
    }
    if (drafted !== undefined) q = q.where('drafted', drafted);
    if (expired) {
      q = q.where((q) => {
        q.where('marketId', 'is', null)
          .where('joinBy', 'is not', null)
          .where('joinBy', '<', 'now()')
          .orWhere('drained', true);
      });
    }
    if (cancelled) q = q.where('cancelAt', 'is not', null).where('cancelAt', '<', 'now()');
    if (matured !== undefined) {
      q = q.where('matureAt', 'is not', null).where('matureAt', matured ? '<' : '>', 'now()');
    }
    if (slashed) q = q.where('slashed', slashed);
    if (offset) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * countTickets count tickets
   * @param network The network name
   * @param marketId The market ID (optional)
   * @param owner Indicate to return ticket with matching owner
   * @param delegate Indicate to return ticket with matching delegate
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param joined Indicate to return tickets (un)joined  to a market
   * @param matured Indicate to return matured tickets
   * @param drafted Indicate to return draft or undrafted tickets
   * @param expired Indicate to return only expired tickets
   * @param cancelled Indicate to return only cancelled tickets
   * @param slashed Indicate to return only slashed tickets
   * @param txn Optional transaction object
   */
  static countTickets(
    network: string,
    marketId?: string,
    owner?: string,
    delegate?: string,
    orderId?: number,
    disputeId?: number,
    joined?: boolean,
    matured?: boolean,
    drafted?: boolean,
    expired?: boolean,
    cancelled?: boolean,
    slashed?: boolean,
    txn?: Transaction,
  ): Promise<Ticket[]> {
    let q = this.query(txn).whereNotDeleted().where({ network });
    if (marketId) q = q.where('marketId', 'ILIKE', marketId);
    q = q.where((q) => {
      if (owner && !delegate) q = q.where('owner', 'ILIKE', owner);
      if (delegate && !owner) q = q.where('delegate', 'ILIKE', delegate);
      if (owner && delegate)
        q.where('owner', 'ILIKE', owner).orWhere('delegate', 'ILIKE', delegate);
    });
    if (orderId !== undefined) q = q.where('orderId', orderId);
    if (disputeId !== undefined) q = q.where('disputeId', disputeId);
    if (joined !== undefined) {
      q = q.where((q) => {
        if (joined) q.orWhere('marketId', 'is not', null);
        else q.orWhere('marketId', 'is', null);
      });
    }
    if (drafted !== undefined) q = q.where('drafted', drafted);
    if (expired) {
      q = q.where((q) => {
        q.where('marketId', null)
          .where('joinBy', 'is not', null)
          .where('joinBy', '<', 'now()')
          .orWhere('drained', true);
      });
    }
    if (cancelled) q = q.where('cancelAt', 'is not', null).where('cancelAt', '<', 'now()');
    if (matured !== undefined) {
      q = q.where('matureAt', 'is not', null).where('matureAt', matured ? '<' : '>', 'now()');
    }
    if (slashed) q = q.where('slashed', slashed);
    return q
      .count('id')
      .first()
      .then((res: any) => res.count);
  }

  /**
   * Remove a delegate ticket
   * @param network The network name
   * @param owner The ticket owner address
   * @param ticketIdx The ticket index
   * @param delegate The invited address
   * @param txn Optional transaction object
   */
  static removeDelegate(
    network: string,
    owner: string,
    ticketIdx: number,
    delegate: string,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where('network', network)
      .where('owner', 'ilike', owner)
      .where('index', ticketIdx)
      .where('delegate', 'ilike', delegate)
      .delete();
  }
}

import { randStr } from '../common/common';
import Objection, { Model, raw, Transaction } from 'objection';
import { BaseModel } from './base';
import Market from './market';
import * as _ from 'lodash';
import { isNil } from 'lodash';
import Draft from './draft';

export enum SearchStatus {
  Maturing = 'maturing',
  Matured = 'matured',
  Joined = 'joined',
  Expired = 'expired',
  Expiring = 'expiring',
  Drafted = 'drafted',
  Undrafted = 'undrafted',
  Slashed = 'slashed',
  Cancelled = 'cancelled',
  Cancelling = 'cancelling',
  Drained = 'drained',
}

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
  // The swap order ID drafted to
  orderId: number = undefined;
  // The pool ID
  poolId: number = undefined;
  // The dispute ID
  disputeId: number = undefined;
  // The amount held as bond
  bond: string = undefined;
  // When the ticket becomes matured
  matureAt: string = undefined;
  // When the ticket is expected to have joined a market or become expired
  joinBy: string = undefined;
  // The transaction hash
  txHash: string = undefined;
  // Indicate whether the ticket has been joined to its pool
  joined: boolean = undefined;
  // Indicates the ticket bond has been drained (ticket becomes expired)
  drained: boolean = undefined;
  // Indicate whether the ticket has been drafted
  drafted: boolean = undefined;
  // Indicate whether the ticket has been slashed
  slashed: boolean = undefined;
  // The time when the ticket is considered cancelled
  cancelAt: string = undefined;
  // The time the ticket was drained
  drainedAt: string = undefined;
  // The time the ticket was drafted
  draftedAt: string = undefined;

  /** Not Persisted */
  market: Market;
  drafts: Draft[];

  matured: boolean;
  expired: boolean;
  cancelling: boolean;
  cancelled: boolean;

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
    return {
      drafts: {
        relation: Model.HasManyRelation,
        modelClass: Draft,
        join: {
          from: ['tickets.network', 'tickets.owner', 'tickets.index'],
          to: ['drafts.network', 'drafts.owner', 'drafts.index'],
        },
      },
    };
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
  static getByNetworkOwnerAndIndex(network: string, owner: string, index: number, select = [], txn?: Transaction) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .select(...select)
      .whereNotDeleted();
    if (index) q = q.where({ index });
    if (network) q = q.where({ network });
    if (owner) q = q.where('owner', 'ilike', owner);
    return q.first();
  }

  // Get total bonds of tickets. Optionally filter by network, poolId, owner
  static async getTotalBonds(network?: string, poolId?: number, owner?: string, drained?: boolean, txn?: Transaction) {
    let q = this.query(txn).sum('bond as total').whereNotDeleted();
    if (network) q = q.where({ network });
    if (poolId) q = q.where({ poolId });
    if (owner) q = q.where('owner', 'ilike', owner);
    if (drained !== undefined) q = q.where({ drained });
    const res = (await q.first()) as Ticket & { total: string };
    return res.total || '0';
  }

  /**
   * updateById updates a notification by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Ticket>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute();
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Ticket()).includes(x));
    select = select.length ? _.uniq(select.concat(['id', 'poolId', 'network', 'owner', 'index', 'orderId'])) : ['*'];
    return select;
  }

  /**
   * searchTickets finds tickets
   * @param network The network name
   * @param poolId The mediator pool ID
   * @param owner Indicate to return ticket with matching owner
   * @param orderId The order ID
   * @param disputeId The dispute ID
   * @param status The status of the ticket
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param relations The relations to be joined (optional)
   * @param txn Optional transaction object
   */
  static searchTickets(
    network: string,
    poolId: number,
    owner: string,
    orderId: number,
    disputeId: number,
    status: SearchStatus,
    limit: number,
    offset: number,
    select = [],
    relations: string,
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .withGraphFetched(relations)
      .select(...select, raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where({ network });
    if (!isNil(poolId)) q = q.where('poolId', poolId);
    if (owner) q = q.where('owner', 'ILIKE', owner);
    if (orderId !== undefined) q = q.where('orderId', orderId);
    if (disputeId !== undefined) q = q.where('disputeId', disputeId);

    if (status) {
      switch (status) {
        case SearchStatus.Maturing:
          q = q.where('matureAt', '>', 'now()');
          break;
        case SearchStatus.Matured:
          q = q.where('matureAt', '<=', 'now()').where({ joined: false });
          break;
        case SearchStatus.Joined:
          q = q.where('joined', true);
          break;
        case SearchStatus.Expired:
          q = q.where('joined', false).where('joinBy', '<', 'now()');
          break;
        case SearchStatus.Expiring:
          q = q.where('matureAt', '<', 'now()');
          q = q.where('joined', false);
          q = q.where('joinBy', '>', 'now()');
          break;
        case SearchStatus.Drafted:
          q = q.where('drafted', true);
          break;
        case SearchStatus.Undrafted:
          q = q.where('drafted', false);
          break;
        case SearchStatus.Slashed:
          q = q.where('slashed', true);
          break;
        case SearchStatus.Cancelled:
          q = q.where('joined', false);
          q = q.where('cancelAt', '<', 'now()');
          break;
        case SearchStatus.Cancelling:
          q = q.where('joined', false);
          q = q.where('cancelAt', '>', 'now()');
          break;
        case SearchStatus.Drained:
          q = q.where('drained', true);
      }
    }

    if (offset != undefined) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * countTickets count tickets
   * @param network The network name
   * @param poolId The mediator pool ID
   * @param owner Indicate to return ticket with matching owner
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
  static async countTickets(
    network: string,
    poolId?: number,
    owner?: string,
    orderId?: number,
    disputeId?: number,
    joined?: boolean,
    matured?: boolean,
    drafted?: boolean,
    expired?: boolean,
    cancelled?: boolean,
    slashed?: boolean,
    txn?: Transaction,
  ): Promise<string> {
    let q = this.query(txn).whereNotDeleted().where({ network });
    if (!isNil(poolId)) q = q.where('poolId', poolId);
    if (owner) q = q.where('owner', 'ILIKE', owner);
    if (orderId !== undefined) q = q.where('orderId', orderId);
    if (disputeId !== undefined) q = q.where('disputeId', disputeId);
    if (joined !== undefined) q = q.where('joined', joined);
    if (drafted !== undefined) q = q.where('drafted', drafted);
    if (expired) {
      q = q.where((q) => {
        return q
          .where('joined', false)
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
    const res = await q.count('id').first();
    return res.count;
  }
}

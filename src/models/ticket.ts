import * as crand from 'crypto-random-string';
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
  // The swap order ID drafted to
  orderId: number = undefined;
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
    this.id = 'ticket_' + crand({ length: 24 });
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
      return this.query(txn).insert(data).then(resolve).catch(reject);
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
  static getById(id: string, txn?: Transaction): Promise<Ticket> {
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
  ): Promise<Ticket> {
    select = select.length ? select.concat(['id']) : select;
    select = select.filter((x) => Object.keys(new Ticket()).includes(x));
    select = select.length
      ? _.uniq(select.concat(['id', 'marketId', 'network', 'owner', 'index', 'orderId']))
      : ['*'];
    return this.query(txn)
      .select(...select)
      .where({ network, index })
      .where('owner', 'ilike', owner)
      .whereNotDeleted()
      .first();
  }

  /**
   * updateById updates a notification by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Ticket>, txn?: Transaction): Promise<Ticket> {
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
}

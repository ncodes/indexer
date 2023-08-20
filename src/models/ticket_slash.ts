import { randStr } from "../common/common";
import Objection, { Transaction } from "objection";
import { BaseModel } from "./base";

/**
 * TicketSlash represents a ticket slash event
 */
export default class TicketSlash extends BaseModel {
  // The network name
  network: string;
  // The owner of the ticket
  owner: string;
  // The index of the ticket
  index: number;
  // The ticket's pool id
  poolId: number;
  // The ticket ID
  ticketId: string;
  // The order ID
  orderId: number;
  // The dispute ID
  disputeId: number;
  // The amount slashed
  amount: string;
  // Indicate whether the ticket voted
  voted: boolean;
  // Indicate whether the ticket was on the winning side
  winSide: boolean;

  constructor(init?: Partial<TicketSlash>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'ticket_slash_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TicketSlash;
    object.object = 'ticket_slash';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'ticket_slashes';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<TicketSlash>, txn?: Transaction): Promise<TicketSlash> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<TicketSlash>, txn?: Transaction): Promise<TicketSlash> {
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
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<TicketSlash>, txn?: Transaction): Promise<TicketSlash> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

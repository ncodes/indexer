import Objection, { raw, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

export enum NotificationType {
  InstantSwap = 'swap:instant',
  InteractiveSwap = 'swap:interactive',
  OrderCancellation = 'order:cancellation',
  OrderPaid = 'order:paid',
  OrderReleased = 'order:released',
  MediateInviteReceived = 'market:perm:mediate:invite_received',
  MediateInviteAccepted = 'market:perm:mediate:invite_accepted',
  MediatePermRevoked = 'market:perm:mediate:revoked',
  PutApproved = 'market:perm:put:approved',
  PutRevoked = 'market:perm:put:revoked',
  SwapApproved = 'market:perm:swap:approved',
  SwapRevoked = 'market:perm:swap:revoked',
  NewLiqManager = 'market:liquidity-manager:updated',
  RemovedLiqManager = 'market:liquidity-manager:removed',
  MediatorJoined = 'market:mediator-ticket:joined',
  MediatorLeft = 'market:mediator-ticket:left',
  DisputeCreated = 'dispute:created',
  DisputeTicketDrafted = 'dispute:ticket-drafted',
  DisputeEvidenceSubmission = 'dispute:evidence-submission',
  EvidencePhaseStarted = 'dispute:evidence-phase-started',
  DisputeTicketSlashed = 'dispute:ticket-slashed',
  EvidencePhaseEnded = 'dispute:evidence-phase-ended',
  CommitPhaseEnded = 'dispute:commit-phase-ended',
  RevealPhaseEnded = 'dispute:reveal-phase-ended',
  DisputeExecuted = 'dispute:executed',
  NewOffer = 'offer:new',
  OfferUpdated = 'offer:updated',
  OfferAccepted = 'offer:accepted',
  OfferUnaccepted = 'offer:unaccepted',
  OfferCancelled = 'offer:cancelled',
  OfferExecuted = 'offer:executed',
  ChatNewMessage = 'chat:new-message',
}

/**
 * Notification represents a notification
 */
export default class Notification extends BaseModel {
  // The network name
  network: string;
  // The notification type
  type: NotificationType;
  // The user ID
  userId: string;
  // The title of the message
  title: string;
  // The body of the message
  body: string;
  // The order ID linked to the notification
  orderId: number;
  // The offer ID linked to the notification
  offerId: number;
  // Indicates whether it has been read
  read: boolean;

  constructor(init?: Partial<Notification>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'notification_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Notification;
    object.object = 'notification';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'notifications';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Notification>, txn?: Transaction): Promise<Notification> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Notification>, txn?: Transaction): Promise<Notification> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Get recent notifications
   * @param network The network name
   * @param type The notification type
   * @param userId The user ID linked to the notification
   * @param orderId The order ID linked to the notification
   * @param offerId The offer ID linked to the notification
   * @param read Indicated whether to filter by read or unread status
   * @param count Indicates to return count of query
   * @param limit The number of records to return
   * @param offset The query offset
   * @param txn The transaction object
   */
  static getRecent(
    network: string,
    type: string,
    userId: string,
    orderId: number,
    offerId: number,
    read: boolean,
    count: boolean,
    limit: number,
    offset: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn).where({ network, userId });

    if (!count) {
      q = q.select(raw('*, count(*) over() as "$queryCount"'));
    }

    if (type) q = q.where({ type });
    if (orderId != undefined) q = q.where({ orderId });
    if (offerId != undefined) q = q.where({ offerId });
    if (read !== undefined) q = q.where({ read });
    if (limit && !count) q = q.limit(limit);
    if (offset != undefined && !count) q = q.offset(offset);

    if (!count) {
      return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
    } else {
      return q
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }
  }

  /**
   * Get recent notifications
   * @param network The network name
   * @param type The notification type
   * @param userId The user ID linked to the notification
   * @param id The notification ID
   * @param orderId The order ID linked to the notification
   * @param offerId The offer ID linked to the notification
   * @param txn The transaction object
   */
  static markAsRead(
    network: string,
    type: string,
    userId: string,
    id: string,
    orderId: number,
    offerId: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn).where({ network, userId, read: false });
    if (id) q = q.where({ id });
    if (type) q = q.where({ type });
    if (orderId != undefined) q = q.where({ orderId });
    if (offerId != undefined) q = q.where({ offerId });
    return q.whereNotDeleted().patch({ read: true });
  }

  /**
   * Get a notification by its ID and user ID
   * @param id The notification ID
   * @param userId The user ID
   * @param txn The transaction object
   */
  static getByIDAndUser(id: string, userId: string, txn?: Transaction) {
    return this.query(txn).where({ id, userId }).first();
  }

  /**
   * updateById updates a notification by ID
   * @param id the notification id
   * @param udp the fields to be updated
   */
  static updateById(id: string, udp: Partial<Notification>): Promise<Notification> {
    return new Promise((resolve, reject) => {
      this.query().whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }
}

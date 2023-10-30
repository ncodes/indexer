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
   * @param count Indicates to return count of query
   * @param userId The user ID linked to the notification
   * @param read Indicated whether to filter by read or unread status
   * @param limit The number of records to return
   * @param offset The query offset
   * @param txn The transaction object
   */
  static getRecent(
    network: string,
    count: boolean,
    userId: string,
    read: boolean,
    limit: number,
    offset: number,
    txn?: Transaction,
  ) {
    if (count) {
      const q = this.query(txn).where({ network, userId });
      return q
        .count('id')
        .first()
        .then((res: any) => {
          return res.count;
        });
    }

    let q = this.query(txn).select(raw('*, count(*) over() as "$queryCount"')).where({ network, userId });
    if (read !== undefined) q = q.where({ read });
    if (limit) q = q.limit(limit);
    if (offset != undefined) q = q.offset(offset);

    return q.whereNotDeleted().orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
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

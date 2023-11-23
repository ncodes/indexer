import Objection, { Model, raw, Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import Dispute from './dispute';
import Liquidity from './liquidity';
import Market from './market';
import Offer from './offer';
import Swap from './swap';

export enum EventActionClass {
  Liquidity = 'liq',
  Swap = 'swap',
  Offer = 'offer',
}

export enum Events {
  LiquidityAdd = 'liq_add',
  LiquidityRemove = 'liq_remove',
  LiquiditySwap = 'liq_swap',
  LiquidityOffer = 'liq_offer',
  LiquidityPause = 'liq_pause',
  LiquidityManagerUpdate = 'liq_manager_update',
  LiquidityTargetUpdate = 'liq_target_update',
  LiquidityPriceUpdate = 'liq_price_update',
  LiquiditySwapLimitUpdate = 'liq_swap_limit_update',
  LiquidityTimeToPayUpdate = 'liq_time_to_pay_update',
  SwapPaid = 'swap_paid',
  SwapReleased = 'swap_released',
  SwapCancelled = 'swap_cancelled',
  SwapDisputed = 'swap_disputed',
  SwapDrafted = 'swap_drafted',
  SwapCommitted = 'swap_committed',
  SwapRevealed = 'swap_revealed',
  SwapExecuted = 'swap_executed',
  SwapUndrafted = 'swap_undrafted',
  OfferCreate = 'offer_create',
  OfferUpdate = 'offer_update',
  OfferAccept = 'offer_accept',
  OfferUnaccept = 'offer_unaccept',
  OfferCancel = 'offer_cancel',
  OfferExecute = 'offer_execute',
}

/**
 * Event represents an event
 */
export default class Event extends BaseModel {
  /** Common **/

  // The network name
  network: string = undefined;
  // The market address
  marketAddress: string = undefined;
  // The internal swap ID
  swapId: string;
  // The swap order ID
  orderId: number = undefined;
  // The offer event action
  action: Events = undefined;
  // The creator or initiator of the liquidity event
  creator: string = undefined;
  // The offer ID
  offerId: number = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The price of the liquidity
  price: string = undefined;

  /** Liquidity Event Fields */

  // The provider address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
  // The minimum swap amount
  minSwap: string = undefined;
  // The maximum swap amount
  maxSwap: string = undefined;
  // The specific address allowed to swap the liquidity
  target: string = undefined;
  // The time required for taker to make payment
  timeToPay: number = undefined;
  // The liquidity manager
  manager: string = undefined;
  // Indicates that the liquidity has been paused
  paused: boolean = undefined;

  /** Swap Event Fields */

  // The dispute ID
  disputeId: number = undefined;
  // The draftee address
  draftee: string = undefined;
  // The revealed vote
  vote: string = undefined;

  /** Offer Event Fields */
  // The NFT IDs to offer for the liquidity
  ids: number[] = undefined;

  /** Relations */
  offer: Offer;
  swap: Swap;
  dispute: Dispute;
  market: Market;

  constructor(init?: Partial<Event>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'event_' + randStr(24);
    this.ids = this.ids ? (JSON.stringify(this.ids) as any) : this.ids;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.ids = JSON.stringify(this.ids) as any;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Event;
    object.object = 'event';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'events';
  }

  static get relationMappings() {
    return {
      market: {
        relation: Model.BelongsToOneRelation,
        modelClass: Market,
        join: {
          from: ['events.network', 'events.marketAddress'],
          to: ['markets.network', 'markets.address'],
        },
      },
      liquidity: {
        relation: Model.BelongsToOneRelation,
        modelClass: Liquidity,
        join: {
          from: ['events.network', 'events.marketAddress', 'events.provider', 'events.lid'],
          to: ['liquidities.network', 'liquidities.marketAddress', 'liquidities.provider', 'liquidities.lid'],
        },
      },
      offer: {
        relation: Model.BelongsToOneRelation,
        modelClass: Offer,
        join: {
          from: ['events.network', 'events.offerId'],
          to: ['offers.network', 'offers.offerId'],
        },
      },
      swap: {
        relation: Model.BelongsToOneRelation,
        modelClass: Swap,
        join: {
          from: ['events.swapId'],
          to: ['swaps.id'],
        },
      },
      dispute: {
        relation: Model.BelongsToOneRelation,
        modelClass: Dispute,
        join: {
          from: ['events.network', 'events.marketAddress', 'events.orderId', 'events.disputeId'],
          to: ['disputes.network', 'disputes.marketAddress', 'disputes.orderId', 'disputes.disputeId'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Event>, txn?: Transaction): Promise<Event> {
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
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Event>, txn?: Transaction) {
    return this.query(txn).where(q).whereNotDeleted().first();
  }

  /**
   * Search for records
   * @param category The event action class
   * @param network The network name
   * @param marketAddress The market address
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param orderId The swap order ID
   * @param offerId The offer ID
   * @param marketAddresses Filter by market addresses
   * @param walletAddresses Filter by wallet addresses
   * @param liquidities Filter by liquidities
   * @param limit The limit
   * @param offset The offset
   * @param lastSerial The last serial number
   * @param txn Optional transaction object
   */
  static search(
    category: EventActionClass,
    network: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
    orderId?: number,
    offerId?: number,
    marketAddresses?: string[],
    walletAddresses?: string[],
    liquidities?: { provider: string; lid: number }[],
    limit?: number,
    offset?: number,
    lastSerial?: number,
    txn?: Transaction,
  ) {
    let q = this.query(txn)
      .select('*', raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where((q) => {
        if (network) q = q.where('network', network);
        if (marketAddress) q = q.where('marketAddress', 'ilike', marketAddress);
        if (provider) q = q.where('provider', 'ilike', provider);
        if (lid != undefined) q = q.where('lid', lid);
        if (orderId) q = q.where('orderId', orderId);
        if (offerId) q = q.where('offerId', offerId);
        q = q.where((q) => {
          if (marketAddresses && marketAddresses.length) {
            q = q.orWhere(raw(`"marketAddress" ILIKE ANY (?)`, [marketAddresses]));
          }
          if (walletAddresses && walletAddresses.length) {
            q = q.orWhere((q) => {
              return q
                .where(raw(`creator ILIKE ANY (?)`, [walletAddresses]))
                .orWhere(raw(`provider ILIKE ANY (?)`, [walletAddresses]));
            });
          }
          if (liquidities && liquidities.length) {
            q = q.orWhere((q) => {
              liquidities.forEach((liq) => {
                q = q.orWhere((q) => {
                  return q.where('provider', liq.provider).where('lid', liq.lid);
                });
              });
            });
          }
          return q;
        });

        if (category) q = q.where('action', 'ilike', category + '%');

        return q;
      })
      .withGraphFetched('[offer.liquidity,liquidity,swap.market,dispute,market]')
      .orderBy('sn', 'desc')
      .orderBy('createdAt', 'desc');
    if (offset != undefined) q = q.offset(offset);
    if (limit) q = q.limit(limit);
    if (lastSerial) q = q.where('sn', '<', lastSerial);
    return q;
  }
}

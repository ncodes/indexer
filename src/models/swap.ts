import * as _ from 'lodash';
import * as moment from 'moment';
import Objection, { Model, Transaction, raw } from 'objection';
import { isEqualStr, randStr, toDec } from '../common/common';
import { BaseModel } from './base';
import Dispute from './dispute';
import Liquidity from './liquidity';
import Market from './market';

export enum SearchStatus {
  Unpaid = 'unpaid',
  Paid = 'paid',
  Released = 'released',
  Disputed = 'disputed',
  Cancelled = 'cancelled',
}

export enum SwapType {
  Instant = 'instant',
  Interactive = 'interactive',
}

/**
 * Swap represents a swap operation
 */
export default class Swap extends BaseModel {
  // The network name
  network?: string = undefined;
  // The market address
  marketAddress?: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // The order ID (if swap created an order)
  orderId?: number = undefined;
  // The liquidity ID
  lid?: number = undefined;
  // The liquidity provider's address
  provider?: string = undefined;
  // The swap initiator's address
  taker?: string = undefined;
  // The offer ID (if the swap originated as a result of an offer execution)
  offerId?: number = undefined;
  // The output amount of the swap
  amount?: string = undefined;
  // The value of the swap in USD
  valueUsd?: string = undefined;
  // The price of 1 unit of output asset
  price?: string = undefined;
  // Indicates whether the order is an instance swap
  instant?: boolean = undefined;
  // Indicates whether the swap was marked as paid.
  paid?: boolean = undefined;
  // The address that marked the swap as paid
  payer?: string = undefined;
  // Indicates whether the swap was cancelled
  cancelled?: boolean = undefined;
  // Indicates whether the swap was released
  released?: boolean = undefined;
  // The address that released or cancelled the swap
  finalizer?: string = undefined;
  // Indicates whether the swap was released/paid via dispute resolution
  byDispute?: boolean = undefined;
  // A list NFT IDs provided by the liquidity provider for the swap
  providerIds?: number[] = undefined;
  // A list NFT IDs provided by the taker for the swap
  takerIds?: number[] = undefined;
  // The protocol fee charged
  protocolFee?: string = undefined;
  // The market fee charged
  marketCreatorFee?: string = undefined;
  // The address of the operator that pushed the swap
  operator?: number = undefined;
  // Time after which the swap can be cancelled
  cancelAt?: string = undefined;
  // Time after which the swap can be disputed after being marked as paid
  disputeFrom?: string = undefined;
  // The transaction hash where the swap was created
  txHash?: string = undefined;
  // The timestamp when the swap was finalized
  finalizedAt?: string = undefined;
  // The timestamp when the swap was marked as paid
  paidAt?: string = undefined;

  /** Not persisted */
  priceUsd?: number = undefined;
  cost?: number = undefined;
  costUsd?: number = undefined;
  amountUsd?: number = undefined;
  fee?: string = undefined;
  feeUsd?: number = undefined;
  feeSymbol?: string = undefined;

  /** Relations */
  market: Market;
  liquidity: Liquidity;
  disputes: Dispute[];

  constructor(init?: Partial<Swap>) {
    super();
    Object.assign(this, init);
  }
  static get tableName() {
    return 'swaps';
  }

  static get relationMappings() {
    return {
      market: {
        relation: Model.BelongsToOneRelation,
        modelClass: Market,
        join: {
          from: ['swaps.network', 'swaps.marketAddress'],
          to: ['markets.network', 'markets.address'],
        },
      },
      liquidity: {
        relation: Model.BelongsToOneRelation,
        modelClass: Liquidity,
        join: {
          from: ['swaps.network', 'swaps.marketAddress', 'swaps.provider', 'swaps.lid'],
          to: ['liquidities.network', 'liquidities.marketAddress', 'liquidities.provider', 'liquidities.lid'],
        },
      },
      disputes: {
        relation: Model.HasManyRelation,
        modelClass: Dispute,
        join: {
          from: ['swaps.network', 'swaps.orderId'],
          to: ['disputes.network', 'disputes.orderId'],
        },
      },
    };
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'swap_' + randStr(24);
    this.providerIds = this.providerIds ? (JSON.stringify(this.providerIds) as any) : this.providerIds;
    this.takerIds = this.takerIds ? (JSON.stringify(this.takerIds) as any) : this.takerIds;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Swap;
    object.object = 'swap';
    delete object.deletedAt;
    return object;
  }

  /**
   * getPayer determines whether the provider or the taker is
   * expected to make off-chain payment
   */
  getPayer() {
    let payer: string;
    const { baseType, quoteType } = this.market;
    if (Market.isERC20(baseType) && Market.isSynth(quoteType)) {
      payer = this.taker;
    } else if (Market.isSynth(baseType) && Market.isSynth(quoteType)) {
      payer = this.taker;
    } else if (Market.isSynth(baseType) && (Market.isERC20(quoteType) || Market.isNFT(quoteType))) {
      payer = this.provider;
    } else if (Market.isNFT(baseType) && Market.isSynth(quoteType)) {
      payer = this.taker;
    }
    return payer;
  }

  /**
   * Checks if the address is one of the swap's dispute draftees.
   * @param swap The swap object
   * @param address The address to check
   * @param recent If true, only checks the most recent dispute
   */
  static isSwapDraftee(swap: Swap, address: string, recent = false) {
    if (!swap.disputes) return false;
    if (recent) return Dispute.isDisputeDraftee(swap.disputes[0], address);
    return swap.disputes.some((d) => d.draftees.some((dr) => isEqualStr(dr.owner, address)));
  }

  /**
   * Checks if the address is either the provider or the taker.
   * @param swap The swap object
   * @param address The address to check
   */
  static isSwapCounterparty(swap: Swap, address: string) {
    return isEqualStr(swap.provider, address) || isEqualStr(swap.taker, address);
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Swap>, txn?: Transaction): Promise<Swap> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * find a record by order ID
   * @param orderId the order ID
   * @param txn Optional transaction object
   */
  static getByOrderId(orderId: number, txn?: Transaction) {
    return this.query(txn).where({ orderId }).whereNotDeleted().first();
  }

  /**
   * find a record by order ID
   * @param network the network
   * @param orderId the order ID
   * @param txn Optional transaction object
   */
  static getByNetworkAndOrderId(network?: string, orderId?: number, txn?: Transaction) {
    return this.query(txn)
      .where((q) => {
        if (network) return q.where({ network });
      })
      .where((q) => {
        if (orderId) return q.where({ orderId });
      })
      .whereNotDeleted()
      .first();
  }

  /**
   * find a record by swap ID
   * @param id the swap ID
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).where({ id }).withGraphFetched('market').whereNotDeleted().first();
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Swap()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat([
            'id',
            'marketAddress',
            'network',
            'base',
            'baseAddress',
            'quote',
            'quoteAddress',
            'provider',
            'orderId',
          ]),
        )
      : ['*'];
    return select;
  }

  /**
   * find a record by order ID
   * @param network The network name
   * @param orderId The order ID
   * @param select Select specific fields (optional)
   * @param relations The relations to be fetched (optional)
   * @param txn Optional transaction object
   */
  static get(network: string, orderId: number, select = [], relations = 'market', txn?: Transaction) {
    select = this.makeSelectList(select);

    let q = this.query(txn).select(...select);

    // If 'disputes' is in the relations, order by dispute createdAt DESC
    if (relations && relations.indexOf('disputes') > -1) {
      q = q.modifyGraph('disputes', (builder) => {
        return builder.orderBy('createdAt', 'DESC');
      });
    }

    return q.where({ network, orderId }).withGraphFetched(relations).whereNotDeleted().first();
  }

  /**
   * updateById updates a swap by ID
   * @param id the swap id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Swap>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).withGraphFetched('market');
  }

  /**
   * count swaps associated with a liquidity
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param instant Filter by instant swap
   * @param minutesAgo Filter by minutes ago
   * @param txn Optional transaction object
   */
  static countLiquiditySwaps(
    network: string,
    marketAddress: string,
    provider: string,
    lid?: number,
    instant?: boolean,
    minutesAgo?: number,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn).where({ network }).where('marketAddress', 'ilike', marketAddress);
      if (provider) q = q.where('provider', 'ilike', provider);
      if (!_.isNil(lid)) q = q.where('lid', lid);
      if (instant !== undefined) q = q.where({ instant });
      if (minutesAgo) q = q.where('createdAt', '>=', moment().subtract(minutesAgo, 'minutes').toISOString());
      q.count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Get the trade volume of a market/provider within now and some time ago.
   * @param network The network name.
   * @param marketAddress The base asset address
   * @param baseAddress The base address
   * @param provider The provider address (ignored if providerOrTaker is set)
   * @param providerOrTaker The provider or taker address (ignored if provider is set)
   * @param lid The liquidity ID
   * @param timeAgo The number of minutes ago to use as the start time
   * @param instant Filter by instant swap
   * @param usd Return volume in USD
   * @param txn Optional transaction object
   */
  static getVolume(
    network: string,
    marketAddress?: string,
    baseAddress?: string,
    provider?: string,
    providerOrTaker?: string,
    lid?: number,
    timeAgo?: number,
    instant?: boolean,
    usd?: boolean,
    txn?: Objection.Transaction,
  ) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .select(raw('sum(??)', !usd ? 'amount' : 'valueUsd').as('total'))
        .where((q) => {
          if (network) q = q.where('network', network);
          if (marketAddress) q = q.where('marketAddress', 'ilike', marketAddress);
          if (baseAddress) q = q.where('baseAddress', 'ilike', baseAddress);
          if (provider && !providerOrTaker) q = q.where('provider', 'ilike', provider);
          if (providerOrTaker && !provider) {
            q = q.where((q) => {
              return q.orWhere('provider', 'ILIKE', providerOrTaker).orWhere('taker', 'ILIKE', providerOrTaker);
            });
          }
          if (!_.isNil(lid)) q = q.where('lid', lid);
          if (instant !== undefined) q = q.where('instant', instant);
          if (timeAgo) q = q.where('createdAt', '>=', moment().subtract(timeAgo, 'minutes').toISOString());
          return q;
        })
        .then((res: any) => {
          return resolve(res[0].total || '0');
        })
        .catch(reject);
    });
  }

  /**
   * Get top markets by USD volume
   * @param network The network name.
   * @param baseAddress The base address
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param timeAgo The number of minutes ago to use as the start time (default: 1440)
   * @param instant Filter by instant swap
   * @param limit The number of records to return
   * @param txn Optional transaction object
   */
  static getTopMarketBy24hUSDVolume(
    network: string,
    baseAddress?: string,
    provider?: string,
    lid?: number,
    timeAgo = 1440,
    instant?: boolean,
    limit = 10,
    txn?: Objection.Transaction,
  ) {
    return new Promise<Market[]>((resolve, reject) => {
      this.query(txn)
        .select('network', 'marketAddress', raw('sum(cast(?? as numeric))', 'valueUsd').as('total'))
        .where((q) => {
          if (network) q = q.where('network', network);
          if (baseAddress) q = q.where('baseAddress', 'ilike', baseAddress);
          if (provider !== undefined) q = q.where('provider', 'ilike', provider);
          if (!_.isNil(lid)) q = q.where('lid', lid);
          if (instant !== undefined) q = q.where('instant', instant);
          if (timeAgo) q = q.where('createdAt', '>=', moment().subtract(timeAgo, 'minutes').toISOString());
          return q;
        })
        .groupBy('marketAddress', 'network')
        .orderBy('total', 'DESC')
        .limit(limit)
        .withGraphFetched('market')
        .then(async (swaps) => {
          return resolve(
            swaps.map((swap: Swap & { total: string }) => {
              swap.market.volume24h = swap.total;
              return swap.market;
            }),
          );
        })
        .catch(reject);
    });
  }

  /**
   * Get the average finalization duration
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param txn Optional transaction object
   */
  static getAvgFinalizeDuration(
    network: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
    txn?: Objection.Transaction,
  ) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .select(raw('avg(extract(epoch from (?? - ??)))', ['finalizedAt', 'createdAt']).as('seconds'))
        .where((q) => {
          if (network) return q.where('network', network);
        })
        .where((q) => {
          if (marketAddress) return q.where('marketAddress', 'ilike', marketAddress);
        })
        .where((q) => {
          if (provider !== undefined) return q.where('provider', 'ilike', provider);
        })
        .where((q) => {
          if (!_.isNil(lid)) return q.where('lid', lid);
        })
        .whereNotDeleted()
        .then((res: any) => {
          return resolve(parseFloat(res[0].seconds || '0'));
        })
        .catch(reject);
    });
  }

  /**
   * Get the average payment duration
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param payer The payer address
   * @param txn Optional transaction object
   */
  static getAvgPaymentDuration(
    network: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
    payer?: string,
    txn?: Objection.Transaction,
  ) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .select(raw('avg(extract(epoch from (?? - ??)))', ['paidAt', 'createdAt']).as('seconds'))
        .where((q) => {
          if (network) return q.where('network', network);
        })
        .where((q) => {
          if (marketAddress) return q.where('marketAddress', 'ilike', marketAddress);
        })
        .where((q) => {
          if (provider !== undefined) return q.where('provider', 'ilike', provider);
        })
        .where((q) => {
          if (!_.isNil(lid)) return q.where('lid', lid);
        })
        .where((q) => {
          if (payer !== undefined) return q.where('payer', 'ilike', payer);
        })
        .whereNotDeleted()
        .then((res: any) => {
          return resolve(parseFloat(res[0].seconds || '0'));
        })
        .catch(reject);
    });
  }

  /**
   * Get the average release duration
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param finalizer The finalizer address
   * @param txn Optional transaction object
   */
  static getAvgReleaseDuration(
    network: string,
    marketAddress?: string,
    provider?: string,
    lid?: number,
    finalizer?: string,
    txn?: Objection.Transaction,
  ) {
    return new Promise<number>((resolve, reject) => {
      this.query(txn)
        .select(raw('avg(extract(epoch from (?? - ??)))', ['finalizedAt', 'paidAt']).as('seconds'))
        .where({ released: true })
        .where((q) => {
          if (network) return q.where('network', network);
        })
        .where((q) => {
          if (marketAddress) return q.where('marketAddress', 'ilike', marketAddress);
        })
        .where((q) => {
          if (provider !== undefined) return q.where('provider', 'ilike', provider);
        })
        .where((q) => {
          if (!_.isNil(lid)) return q.where('lid', lid);
        })
        .where((q) => {
          if (finalizer !== undefined) return q.where('finalizer', 'ilike', finalizer);
        })
        .whereNotDeleted()
        .then((res: any) => {
          return resolve(parseFloat(res[0].seconds || '0'));
        })
        .catch(reject);
    });
  }

  /**
   * Count number of released, cancelled or disputed swaps
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address (ignored if providerOrTaker is set)
   * @param providerOrTaker Filter only where address is provider or taker (ignored if provider is set)
   * @param released Indicate to return count for released swaps
   * @param cancelled Indicate to return count for cancelled swaps
   * @param disputed Indicate to return count for disputed swaps
   * @param txn
   */
  static countByStatus({
    network,
    marketAddress,
    provider,
    providerOrTaker,
    instant,
    released,
    cancelled,
    disputed,
    txn,
  }: {
    network?: string;
    marketAddress?: string;
    provider?: string;
    providerOrTaker?: string;
    released?: boolean;
    cancelled?: boolean;
    disputed?: boolean;
    instant?: boolean;
    txn?: Objection.Transaction;
  } = {}) {
    return new Promise<string>((resolve, reject) => {
      let q = this.query(txn);
      if (network) q = q.where('network', network);
      if (marketAddress) q = q.where('marketAddress', 'ilike', marketAddress);
      if (!providerOrTaker && provider) q = q.where('provider', 'ilike', provider);
      if (!provider && providerOrTaker) {
        q = q.where((q) => {
          return q.orWhere('provider', 'ILIKE', providerOrTaker).orWhere('taker', 'ILIKE', providerOrTaker);
        });
      }
      if (released !== undefined) q = q.where({ released });
      if (cancelled !== undefined) q = q.where({ cancelled });
      if (disputed !== undefined) q = q.where({ byDispute: disputed });
      if (instant !== undefined) q = q.where({ instant });
      q.count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Calculate completion rate
   * @param network The network name
   * @param marketAddress The market ID
   * @param provider The provider address (ignored if providerOrTaker is set)
   * @param providerOrTaker Filter only where address is provider or taker (ignored if provider is set)
   * @param txn Optional transaction object
   */
  static async getCompletionRate(
    network: string,
    marketAddress: string,
    provider: string,
    providerOrTaker?: string,
    txn?: Objection.Transaction,
  ) {
    const nReleased = await Swap.countByStatus({
      network,
      marketAddress,
      provider,
      providerOrTaker,
      released: true,
      cancelled: undefined,
      disputed: false,
      txn,
    });
    const nSwaps = await Swap.countByStatus({
      network,
      marketAddress,
      provider,
      providerOrTaker,
      released: undefined,
      cancelled: undefined,
      disputed: undefined,
      txn,
    });
    return Promise.resolve(toDec(nReleased).div(nSwaps).mul(100).toDP(2).toNumber() || 0);
  }

  /**
   * search for swaps
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param base The base asset address or symbol (optional)
   * @param quote The quote asset address or symbol (optional)
   * @param providerOrTaker Filter only where address is provider or taker
   * @param fromDate The start date to filter by (optional)
   * @param toDate The end date to filter by (optional)
   * @param status The swap status (optional)
   * @param type The swap type (optional)
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param relations The relations to be fetched (optional)
   * @param txn Optional transaction object
   */
  static search(
    network: string,
    marketAddress: string,
    base: string,
    quote: string,
    providerOrTaker: string,
    fromDate: string,
    toDate: string,
    status: SearchStatus,
    type: SwapType,
    limit: number,
    offset: number,
    select = [],
    relations: string = undefined,
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    let q = this.query(txn)
      .withGraphFetched(relations)
      .select(...select, raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where({ network });

    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);

    if (providerOrTaker) {
      q = q.where((q) => {
        return q.orWhere('provider', 'ILIKE', providerOrTaker).orWhere('taker', 'ILIKE', providerOrTaker);
      });
    }

    if (base) {
      q = q.where((q) => {
        return q.where('baseAddress', 'ILIKE', base).orWhere('base', 'ILIKE', base);
      });
    }

    if (quote) {
      q = q.where((q) => {
        return q.where('quoteAddress', 'ILIKE', quote).orWhere('quote', 'ILIKE', quote);
      });
    }

    if (fromDate) q = q.where('createdAt', '>=', fromDate);

    if (toDate) q = q.where('createdAt', '<=', toDate);

    if (status) {
      switch (status) {
        case SearchStatus.Unpaid:
          q = q.where({ paid: false, cancelled: false });
          break;
        case SearchStatus.Paid:
          q = q.where({ paid: true });
          break;
        case SearchStatus.Released:
          q = q.where({ released: true });
          break;
        case SearchStatus.Disputed:
          q = q.where({ byDispute: true });
          break;
        case SearchStatus.Cancelled:
          q = q.where({ cancelled: true });
          break;
      }
    }

    if (type) {
      switch (type) {
        case SwapType.Instant:
          q = q.where({ instant: true });
          break;
        case SwapType.Interactive:
          q = q.where({ instant: false });
          break;
      }
    }

    // If 'disputes' is in the relations, order by dispute createdAt DESC
    if (relations && relations.indexOf('disputes') > -1) {
      q = q.modifyGraph('disputes', (builder) => {
        return builder.orderBy('createdAt', 'DESC');
      });
    }

    if (offset != undefined) q = q.offset(offset);

    if (limit) q = q.limit(limit);

    return q.orderBy('createdAt', 'DESC').orderBy('sn', 'DESC');
  }

  /**
   * Get most recent swap by provider or taker in network
   * @param network The network name
   * @param providerOrTaker The provider or taker address
   * @param txn Optional transaction object
   */
  static getRecentSwap(network: string, providerOrTaker: string, txn?: Transaction) {
    return this.query(txn)
      .where((q) => {
        if (network) return q.where('network', network);
      })
      .where((q) => {
        return q.orWhere('provider', 'ILIKE', providerOrTaker).orWhere('taker', 'ILIKE', providerOrTaker);
      })
      .whereNotDeleted()
      .withGraphFetched('market')
      .orderBy('createdAt', 'DESC')
      .first();
  }

  /**
   * Count the number of swaps completed by a taker for a given liquidity
   * @param taker The address of the taker/swapper
   * @param market The market address
   * @param provider The liquidity provider address
   * @param lid The liquidity id
   * @param txn Optional transaction object
   * @returns
   */
  static async countSwapsOfTakerForLiquidity(
    taker: string,
    market: string,
    provider: string,
    lid: number,
    txn?: Transaction,
  ) {
    return this.query(txn)
      .where('taker', 'ILIKE', taker)
      .where('marketAddress', 'ilike', market)
      .where('provider', 'ilike', provider)
      .where('lid', lid)
      .whereNotDeleted()
      .count('id')
      .first()
      .then((res: any) => {
        return res.count;
      });
  }

  /**
   * Total amount of swaps completed by a taker for a given liquidity
   * owned by a provider in a market
   * @param market The market address
   * @param provider The liquidity provider address
   * @param taker The taker address
   * @param txn Optional transaction object
   * @returns
   */
  static async getTotalAmountByMarketProviderTaker(market: string, provider: string, taker: string, txn?: Transaction) {
    return this.query(txn)
      .where('marketAddress', 'ilike', market)
      .where('provider', 'ilike', provider)
      .where('taker', 'ilike', taker)
      .whereNotDeleted()
      .sum('amount')
      .first()
      .then((res: any) => {
        return res.sum || '0';
      });
  }
}

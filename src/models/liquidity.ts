import { AbiCoder, getCreate2Address, keccak256, toUtf8Bytes } from 'ethers';
import * as _ from 'lodash';
import * as moment from 'moment';
import Objection, { Model, Transaction, raw } from 'objection';
import { randStr, toDec } from '../common/common';
import { BaseModel } from './base';
import Market, { AssetType } from './market';
import { pow10 } from '../network/common';

/**
 * Derive a liquidity address
 * @param marketAddress - The market address
 * @param provider - The provider address
 * @param lid - The liquidity ID
 */
export function makeLiqAddress(marketAddress: string, provider: string, lid: number) {
  return getCreate2Address(
    marketAddress,
    keccak256(AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [provider, lid])),
    keccak256(toUtf8Bytes('Liquidity(address provider, uint256 lid)')),
  );
}

export interface FillResult {
  side: string;
  liquidities: Liquidity[];
  totalAmountFilled: string;
  amount: string;
  filled: boolean;
  totalQuantityFilled: string;
  totalQuantityFilledAfterFees?: string;
  totalFees?: string;
  totalProtoFee?: string;
  totalMktFee?: string;
  protoFeePct?: number;
  mktFeePct?: number;
}

/**
 * Liquidity represents a liquidity model
 */
export default class Liquidity extends BaseModel {
  // The network associated with this object
  network: string = undefined;
  // The provider address
  provider: string = undefined;
  // The liquidity ID
  lid: number;
  // The market address
  marketAddress: string = undefined;
  // The unique address of the liquidity
  address: string = undefined;
  // The base asset symbol
  base: string = undefined;
  // The base asset address
  baseAddress: string = undefined;
  // Indicates the type of the base asset
  baseType: AssetType = undefined;
  // The quote asset symbol
  quote: string = undefined;
  // The quote asset address
  quoteAddress: string = undefined;
  // Indicates the type of quote asset
  quoteType: AssetType = undefined;
  // The liquidity amount
  amount: string = undefined;
  // The all-time amount of liquidity swapped
  amountSwapped: string = undefined;
  // The price of the liquidity
  price: string = undefined;
  // The minimum swap amount
  minSwap: string = undefined;
  // The maximum swap amount
  maxSwap: string = undefined;
  // The specific address allowed to swap the liquidity
  target: string = undefined;
  // The NFT IDs that make up the liquidity
  ids: number[] = undefined;
  // A list of NFT IDs of which the liquidity provider wants at least one
  // in return for the liquidity
  wantOrIds: number[] = undefined;
  // A list of NFT IDs of which the liquidity provider wants all
  // in return for the liquidity
  wantAndIds: number[] = undefined;
  // The time required for taker to make payment
  timeToPay: number = undefined;
  // The liquidity manager
  manager: string = undefined;
  // Indicates that the liquidity has been paused
  paused: boolean = undefined;
  // Indicates that the swapping has been disabled for the liquidity
  swapDisabled: boolean = undefined;
  // The number of open swap orders
  openOrders: number = undefined;
  // The last time this liquidity successfully completed a swap
  lastSwapAt: string = undefined;
  // The swap completion rate of this liquidity
  completionRate: number = undefined;
  // The number of active disputes
  openDisputes: number = undefined;
  // The number of disputes ever created (excluding appeals)
  totalDisputes: number = undefined;
  // The number of swaps
  totalSwaps: number = undefined;
  // The dispute rate of this market
  disputeRate: number = undefined;
  // The satisfactory rate from reviews
  satisfactoryRate: number = undefined;
  // The list of required badges to swap
  requiredSwapBadges: string[] = undefined;
  // The average number of seconds within which swaps are finalized
  avgFinalizeDur: number;
  // The average number of seconds within which swaps are marked as paid
  avgPaymentDur: number;
  // The average number of seconds within which swaps are marked as released
  avgReleaseDur: number;
  // The list of payment methods badges associated
  paymentMethods: string[];
  // Indicate if messaging is enabled
  messagingEnabled: boolean;
  // The time messaging enablement status was last updated
  messagingEnabledUpdatedAt: string;
  // Whether the liquidity is hidden
  hidden: boolean;

  /** Not Persisted */
  totalSwaps24h: string;
  volume24h: string;
  priceChange: number;
  priceUsd: number;
  amountUsd: number;
  minSwapUsd: number;
  maxSwapUsd: number;
  online: boolean;
  lastTimeOnline: string;
  amountFilled: string;
  quantityFilled: string;
  protoFee: string;
  mktCreatorFee: string;
  quantityFilledAfterFees: string;

  /** Relations */
  market: Market;

  constructor(init?: Partial<Liquidity>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'liquidity_' + randStr(24);
    this.ids = this.ids ? (JSON.stringify(this.ids) as any) : this.ids;
    this.wantOrIds = this.wantOrIds ? (JSON.stringify(this.wantOrIds) as any) : this.wantOrIds;
    this.wantAndIds = this.wantAndIds ? (JSON.stringify(this.wantAndIds) as any) : this.wantAndIds;
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
    this.paymentMethods = this.paymentMethods ? (JSON.stringify(this.paymentMethods) as any) : this.paymentMethods;
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.ids = JSON.stringify(this.ids) as any;
    this.wantOrIds = JSON.stringify(this.wantOrIds) as any;
    this.wantAndIds = JSON.stringify(this.wantAndIds) as any;
    this.requiredSwapBadges = this.requiredSwapBadges
      ? (JSON.stringify(this.requiredSwapBadges) as any)
      : this.requiredSwapBadges;
    this.paymentMethods = this.paymentMethods ? (JSON.stringify(this.paymentMethods) as any) : this.paymentMethods;
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as Liquidity;
    object.object = 'liquidity';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'liquidities';
  }

  static get relationMappings() {
    return {
      market: {
        relation: Model.BelongsToOneRelation,
        modelClass: Market,
        join: {
          from: ['liquidities.network', 'liquidities.marketAddress'],
          to: ['markets.network', 'markets.address'],
        },
      },
    };
  }

  /**
   * create a record
   * @param data The transfer info
   * @param txn Optional transaction object
   */
  static create(data: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity> {
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

  // Get liquidities by optionally network, market and provider
  static async getLiquidities(network: string, marketAddress?: string, provider?: string, txn?: Transaction) {
    let q = this.query(txn);
    if (network) q = q.where({ network });
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    return q.orderBy('createdAt', 'DESC');
  }

  /**
   * Get providers that have not enabled messaging
   * @param within Ignore records updated within the last n seconds
   * @param txn Optional transaction object
   * @returns
   */
  static async getProvidersWithDisabledMessaging(within: number, txn?: Transaction) {
    return (
      await this.query(txn)
        .select('provider')
        .where({ messagingEnabled: false })
        .where((q) => {
          return q
            .orWhereNull('messagingEnabledUpdatedAt')
            .orWhere('messagingEnabledUpdatedAt', '<', moment().subtract(within, 's').toISOString());
        })
        .distinct('provider')
    ).map((x) => x.provider);
  }

  /**
   * getLiquidity finds a liquidity
   * @param network The network name
   * @param mid The market ID
   * @param provider The provider address
   * @param lid The liquidity ID
   * @param select Select specific fields (optional)
   * @param relations The relations to be fetched (optional)
   * @param txn Optional transaction object
   */
  static getLiquidity(
    network: string,
    mid?: string,
    provider?: string,
    lid?: number,
    select = [],
    relations = '',
    txn?: Transaction,
  ) {
    select = this.makeSelectList(select);
    return this.query(txn)
      .select(...select)
      .whereNotDeleted()
      .where({ network })
      .where((q) => {
        if (mid) q = q.where('marketAddress', 'ILIKE', mid);
        if (provider) q = q.where('provider', 'ILIKE', provider);
        if (!_.isNil(lid)) q = q.where('lid', lid);
        return q;
      })
      .withGraphFetched(relations)
      .first();
  }

  /**
   * Find liquidity by address
   * @param network The network name
   * @param address The liquidity address
   * @param relations The relations to be fetched (optional)
   * @param txn Optional transaction object
   */
  static getByAddress(network: string, address: string, relations = '', txn?: Transaction) {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network })
      .where((q) => {
        return q.where('address', 'ILIKE', address);
      })
      .withGraphFetched(relations)
      .first();
  }

  /**
   * Update all liquidities belonging to a provider in a given network and market
   * @param network The network name
   * @param marketAddress The market address
   * @param provider The provider address
   * @param lid The liquidity ID (optional)
   * @param upd The update object
   * @param txn Optional transaction object
   */
  static update(
    network: string,
    marketAddress: string,
    provider: string,
    lid: number = undefined,
    upd: Partial<Liquidity>,
    txn?: Objection.Transaction,
  ) {
    return this.query(txn)
      .whereNotDeleted()
      .where({ network })
      .where('marketAddress', 'ILIKE', marketAddress)
      .where('provider', 'ILIKE', provider)
      .where((q) => {
        if (lid != undefined) return q.where('lid', lid);
      })
      .patch(upd);
  }

  static makeSelectList(select = []) {
    select = select.filter((x) => Object.keys(new Liquidity()).includes(x));
    select = select.length
      ? _.uniq(
          select.concat(['id', 'marketAddress', 'network', 'provider', 'base', 'baseAddress', 'quote', 'quoteAddress']),
        )
      : ['*'];
    return select;
  }

  /**
   * Get liquidities that can fill a given amount
   * @param market The target market
   * @param side The side of the market to fill (base or quote)
   * @param amount The amount to fill (base or quote amount)
   * @param txn Optional transaction object
   */
  static async fill(market: Market, side: 'base' | 'quote', amount: string, txn?: Transaction): Promise<FillResult> {
    const { quoteDecimals, baseDecimals } = market;

    if (market.isFungible()) {
      if (side === 'quote') {
        const q = this.query(txn)
          .with('sample', (builder) => {
            builder
              .select(
                'id',
                'provider',
                'lid',
                'amount',
                'price',
                raw('price * amount / power(10,??) AS cost', quoteDecimals),
                raw(`SUM(amount * price / power(10,??)) OVER (ORDER BY price,amount DESC) AS cumulative_cost`, [
                  quoteDecimals,
                ]),
              )
              .from(Liquidity.tableName);
          })
          .from('sample')
          .select('*')
          .where('cumulative_cost', '<=', amount)
          .orWhereRaw('cumulative_cost - ?? < ?', ['cost', amount])
          .orderBy('price', 'asc');

        const liquidities = await q.execute();

        let totalFilled = toDec(0);
        let amountFilled = toDec(0);
        for (const f of liquidities as (Liquidity & { cost: string; cumulative_cost: string })[]) {
          const unfilled = toDec(amount).sub(totalFilled);
          if (toDec(f.cost).lte(unfilled)) {
            f.amountFilled = f.cost.toString();
            totalFilled = totalFilled.add(f.cost);
            f.quantityFilled = toDec(f.amountFilled).div(toDec(f.price)).mul(pow10(baseDecimals)).toFixed();
            amountFilled = amountFilled.add(f.quantityFilled);
          } else {
            f.amountFilled = unfilled.toFixed();
            totalFilled = totalFilled.add(f.amountFilled);
            f.quantityFilled = toDec(f.amountFilled).div(toDec(f.price)).mul(pow10(baseDecimals)).toFixed();
            amountFilled = amountFilled.add(f.quantityFilled);
          }

          delete f.cumulative_cost;
          delete f.cost;
        }

        return {
          liquidities,
          totalAmountFilled: totalFilled.toFixed(),
          amount,
          filled: totalFilled.gte(amount),
          totalQuantityFilled: amountFilled.toFixed(),
          side,
        };
      }

      if (side === 'base') {
        const q = this.query(txn)
          .with('sample', (builder) => {
            builder
              .select(
                'id',
                'provider',
                'lid',
                'amount',
                'price',
                raw('price * amount / power(10,??) AS cost', quoteDecimals),
                raw(`SUM(amount) OVER (ORDER BY price,amount DESC) AS cumulative_amount`),
              )
              .from(Liquidity.tableName);
          })
          .from('sample')
          .select('*')
          .where('cumulative_amount', '<=', amount)
          .orWhereRaw('cumulative_amount - ?? < ?', ['amount', amount])
          .orderBy('price', 'asc');

        const liquidities = await q.execute();

        let totalFilled = toDec(0);
        let amountFilled = toDec(0);
        for (const f of liquidities as (Liquidity & { cost: string; cumulative_amount: string })[]) {
          const unfilled = toDec(amount).sub(totalFilled);
          if (toDec(f.amount).lte(unfilled)) {
            f.amountFilled = f.amount.toString();
            totalFilled = totalFilled.add(f.amount);
            f.quantityFilled = toDec(f.amountFilled).mul(toDec(f.price)).div(pow10(quoteDecimals)).toFixed();
            amountFilled = amountFilled.add(f.quantityFilled);
          } else {
            f.amountFilled = unfilled.toFixed();
            totalFilled = totalFilled.add(f.amountFilled);
            f.quantityFilled = toDec(f.amountFilled).mul(toDec(f.price)).div(pow10(quoteDecimals)).toFixed();
            amountFilled = amountFilled.add(f.quantityFilled);
          }

          delete f.cumulative_amount;
          delete f.cost;
        }

        return {
          liquidities,
          totalAmountFilled: totalFilled.toFixed(),
          amount,
          filled: totalFilled.gte(amount),
          totalQuantityFilled: amountFilled.toFixed(),
          side,
        };
      }
    }

    throw new Error('not implemented');
  }

  /**
   * getLiquidities finds liquidities
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param base Filter by base token address (optional)
   * @param quote Filter by quote token address (optional)
   * @param provider Filter by provider address (optional)
   * @param paused Filter by paused status (optional)
   * @param maxOpenDisputes Allow only records with lower open disputes
   * @param maxOpenOrders Allow only records with lower open orders
   * @param amount Filter by swap amount
   * @param price Filter by price
   * @param amountUsd Filter by swap amount in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param priceUsd Filter by price in USD (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param quoteUsdRate The USD rate to use for price to USD conversions
   * @param baseUsdRate The USD rate to use for amount to USD conversions
   * @param reqLpBadges Filter by badges liquidity providers must have been granted
   * @param reqSwapBadges Filter by badges takers must have been granted
   * @param paymentMethods Filter by payment methods
   * @param liquidities Filter by liquidities
   * @param limit The number of records to return (optional).
   * @param offset The query offset (optional)
   * @param select Select specific fields (optional)
   * @param hidden Filter by hidden status (optional)
   * @param txn Optional transaction object
   */
  static search({
    network,
    marketAddress,
    base,
    quote,
    provider,
    paused,
    maxOpenDisputes,
    maxOpenOrders,
    amount,
    price,
    amountUsd,
    priceUsd,
    quoteUsdRate = 0,
    baseUsdRate = 0,
    reqLpBadges,
    reqSwapBadges,
    paymentMethods,
    liquidities,
    limit,
    offset,
    select = [],
    hidden,
    txn,
  }: {
    network?: string;
    marketAddress?: string;
    base?: string;
    quote?: string;
    provider?: string;
    paused?: boolean;
    maxOpenDisputes?: number;
    maxOpenOrders?: number;
    amount?: string;
    price?: string;
    amountUsd?: string;
    priceUsd?: string;
    quoteUsdRate?: number;
    baseUsdRate?: number;
    reqLpBadges?: string[];
    reqSwapBadges?: string[];
    paymentMethods?: string[];
    liquidities?: { marketAddress: string; provider: string; lid: number }[];
    limit?: number;
    offset?: number;
    select?: any[];
    hidden?: boolean;
    txn?: Objection.Transaction;
  }) {
    select = this.makeSelectList(select);
    let q = this.query(txn).withGraphFetched('market');

    q = q.from((sub) => {
      sub = sub
        .from('liquidities')
        .select(
          'liquidities.*',
          raw('"price" * ? / 10^"quoteDecimals" as "priceUsd"', [quoteUsdRate]),
          raw('"amount" * ? / 10^"baseDecimals" as "amountUsd"', [baseUsdRate]),
        )
        .innerJoin('markets', (q) => {
          return q
            .on('markets.address', 'ILIKE', 'liquidities.marketAddress')
            .andOn('markets.network', '=', 'liquidities.network');
        });
      return sub.as('s');
    });

    if (!_.isEmpty(reqLpBadges)) {
      q = q.alias('s').from((sub) => {
        return sub
          .from('liquidities')
          .select('liquidities.*')
          .leftJoin('badge_grants', (q) => {
            return q
              .on('badge_grants.grantee', 'ILIKE', 'liquidities.provider')
              .andOn('badge_grants.network', 'ILIKE', 'liquidities.network');
          })
          .where((q) => {
            return q
              .whereRaw(`badge_grants.badge ILIKE ANY (?)`, [reqLpBadges])
              .orWhereRaw(`badge_grants.path ILIKE ANY (?)`, [reqLpBadges]);
          })
          .where((q) => {
            return q.whereNull('badge_grants.expireAt').orWhere('badge_grants.expireAt', '>', moment().toISOString());
          })
          .as('s');
      });
    }

    q = q
      .alias('s')
      .select(...select, raw('count(*) over() as' + ' "$queryCount"'))
      .whereNotDeleted()
      .where('s.network', network)
      .where((q) => {
        if (!provider) return q.where('s.amount', '>', '0');
      });

    if (marketAddress) {
      q = q.where('s.marketAddress', 'ILIKE', marketAddress);
    }

    if (base) {
      q = q.where((q) => {
        return q.where('s.baseAddress', 'ILIKE', base).orWhere('s.base', 'ILIKE', base);
      });
    }

    if (quote) {
      q = q.where((q) => {
        return q.where('s.quoteAddress', 'ILIKE', quote).orWhere('s.quote', 'ILIKE', quote);
      });
    }

    if (provider) {
      q = q.where('s.provider', 'ILIKE', provider);
    }

    if (paused != undefined) {
      q = q.where('s.paused', paused);
    }

    if (maxOpenDisputes) {
      q = q.where('s.openDisputes', '<', maxOpenDisputes);
    }

    if (maxOpenOrders) {
      q = q.where('s.openOrders', '<', maxOpenOrders);
    }

    if (amount) {
      const operator = amount.startsWith('>') ? '>=' : '<=';
      const amountValue = amount.replace('>', '').replace('<', '');
      q = q.where('s.minSwap', operator, amountValue);
    }

    if (price) {
      const operator = price.startsWith('>') ? '>=' : '<=';
      const amountValue = price.replace('>', '').replace('<', '');
      q = q.where('s.price', operator, amountValue);
    }

    if (amountUsd) {
      const operator = amountUsd.startsWith('>') ? '>=' : '<=';
      const amountValue = amountUsd.replace('>', '').replace('<', '');
      q = q.where('s.amountUsd', operator, amountValue);
    }

    if (priceUsd) {
      const operator = priceUsd.startsWith('>') ? '>=' : '<=';
      const amountValue = priceUsd.replace('>', '').replace('<', '');
      q = q.where('s.priceUsd', operator, amountValue);
    }

    if (liquidities && liquidities.length) {
      q = q.andWhere((q) => {
        liquidities.forEach((liq) => {
          q = q.orWhere((q) => {
            return q.where('marketAddress', liq.marketAddress).where('provider', liq.provider).where('lid', liq.lid);
          });
        });
      });
    }

    if (!_.isEmpty(reqSwapBadges)) {
      q = q.whereRaw(
        `EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text("requiredSwapBadges") badge
      WHERE badge ILIKE ANY (?)
      )`,
        [reqSwapBadges],
      );
    }

    if (!_.isEmpty(paymentMethods)) {
      q = q.whereRaw(
        `EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text("paymentMethods") method
      WHERE method ILIKE ANY (?)
      )`,
        [paymentMethods],
      );
    }

    if (hidden != undefined) {
      q = q.where('s.hidden', hidden);
    }

    if (offset != undefined) {
      q = q.offset(offset);
    }

    if (limit) {
      q = q.limit(limit);
    }

    return q
      .orderBy('avgFinalizeDur', 'ASC') // prefer low finalize duration
      .orderBy('avgPaymentDur', 'ASC') // prefer low payment duration
      .orderBy('avgReleaseDur', 'ASC') // prefer low release duration
      .orderBy('s.amountSwapped', 'DESC') // prefer higher volume
      .orderBy('s.totalSwaps', 'DESC') // prefer higher number of swaps
      .orderBy('s.completionRate', 'DESC') // prefer higher completion rate
      .orderBy('s.satisfactoryRate', 'DESC') // prefer higher satisfactory rate
      .orderBy('s.updatedAt', 'DESC');
  }

  /**
   * countLiquidities count liquidities by network and optional provider
   * @param network The network name
   * @param marketAddress The market ID (optional)
   * @param provider Filter by provider address (optional)
   * @param maxOpenDisputes Allow only records with lower open disputes
   * @param txn Optional transaction object
   */
  static async countLiquidities(
    network: string,
    marketAddress?: string,
    provider?: string,
    maxOpenDisputes?: number,
    txn?: Transaction,
  ): Promise<string> {
    let q = this.query(txn).whereNotDeleted().where({ network, paused: false });
    if (marketAddress) q = q.where('marketAddress', 'ILIKE', marketAddress);
    if (provider) q = q.where('provider', 'ILIKE', provider);
    if (maxOpenDisputes) q = q.where('openDisputes', '<', maxOpenDisputes);
    const res = await q.count('id').first();
    return res.count || '0';
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<Liquidity>, txn?: Transaction): Promise<Liquidity> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * count returns the count of record matching q
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static count(q: Partial<Liquidity>, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where(q)
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * updateById updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<Liquidity>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  /**
   * Update a record by provider address
   * @param provider The provider address
   * @param upd The fields to be updated
   * @param txn Optional transaction object
   * @returns
   */
  static updateByProviderAddress(provider: string, upd: Partial<Liquidity>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('provider', 'ILIKE', provider).patch(upd);
  }

  /**
   * Count number of non-zero liquidity providers associated with a market
   * @param net The network name
   * @param mid The market ID
   * @param txn Optional transaction object
   * @returns
   */
  static countProvidersInMarket(net: string, mid: string, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      this.query(txn)
        .where('marketAddress', 'ILIKE', mid)
        .where('amount', '>', 0)
        .where({ network: net })
        .count('id')
        .whereNotDeleted()
        .first()
        .then((res: any) => {
          return resolve(res.count);
        })
        .catch(reject);
    });
  }

  /**
   * Get the lowest liquidity price
   * @param net The network name
   * @param mid The market ID
   * @param baseAddress The base address
   * @param withinHours Limit query with now() - n hours
   * @param txn Optional transaction object
   * @returns
   */
  static getLowestPrice(net?: string, mid?: string, baseAddress?: string, withinHours?: number, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) q = q.where({ network: net });
          if (mid) q = q.where('marketAddress', 'ILIKE', mid);
          if (baseAddress) q = q.where('baseAddress', 'ILIKE', baseAddress);
          if (withinHours) q = q.where('createdAt', '>', timeAgo);
          return q;
        })
        .where('amount', '>', 0)
        .orderByRaw('cast(price as numeric) asc')
        .whereNotDeleted()
        .first()
        .then((liq) => {
          if (!liq) return resolve('0');
          return resolve(liq.price);
        })
        .catch(reject);
    });
  }

  /**
   * Get the highest liquidity price
   * @param net The network name
   * @param mid The market ID
   * @param baseAddress The base address
   * @param withinHours Limit query with now() - n hours
   * @param txn Optional transaction object
   * @returns
   */
  static getHighestPrice(net: string, mid: string, baseAddress?: string, withinHours?: number, txn?: Transaction) {
    return new Promise<string>((resolve, reject) => {
      const timeAgo = moment().subtract(withinHours, 'h').toISOString();
      this.query(txn)
        .where((q) => {
          if (net) return q.where({ network: net });
        })
        .where((q) => {
          if (mid) return q.where('marketAddress', 'ILIKE', mid);
        })
        .where((q) => {
          if (baseAddress) return q.where('baseAddress', 'ILIKE', baseAddress);
        })
        .where('amount', '>', 0)
        .where((q) => {
          if (withinHours) return q.where('createdAt', '>', timeAgo);
        })
        .orderByRaw('cast(price as numeric) desc')
        .whereNotDeleted()
        .first()
        .then((liq) => {
          if (!liq) return resolve('0');
          return resolve(liq.price);
        })
        .catch(reject);
    });
  }
}

import { getCurrency } from '@jointlabs/meta';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import { getContractsAddress, toDec } from '../../common/common';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Market from '../../models/market';
import Meta, { MetaKeys } from '../../models/meta';
import PayRouterRoute from '../../models/pay_router_route';
import Swap from '../../models/swap';
import User from '../../models/user';
import { isZero } from '../../network/common';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';

@Injectable()
export default class SwapService {
  constructor(
    private metadataSrv: MetadataService,
    private cfgSrv: ConfigService,
    private exrSrv: ExchangeRateService,
  ) {}

  /**
   * Extend swap with peripheral and derived data
   * @param swap
   * @param select
   */
  async extendSwap(swap: Swap, select: string[] = []): Promise<void> {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    try {
      const { network, price, baseAddress, quoteAddress, amount } = swap;

      if (!swap.priceUsd && ((select.includes(`priceUsd`) && !isZero(price)) || !select.length)) {
        swap.priceUsd = await this.metadataSrv.tryToUsd(network, price, quoteAddress);
      }

      if (!swap.amountUsd && ((select.includes(`amountUsd`) && !isZero(amount)) || !select.length)) {
        swap.amountUsd = await this.metadataSrv.tryToUsd(network, amount, baseAddress);
      }

      if (!swap.cost && (select.includes(`cost`) || !select.length)) {
        const { baseType, quoteType, baseDecimals, quoteDecimals } = swap.market;
        if (Market.isFungible(baseType) && Market.isFungible(quoteType)) {
          swap.cost = toDec(amount)
            .mul(price)
            .div(toDec(10).pow(baseDecimals + quoteDecimals))
            .toNumber();
          swap.costUsd = await this.metadataSrv.tryToUsd(network, swap.cost.toString(), quoteAddress, {
            isHD: true,
            refetch: true,
          });
        }
      }

      if (!swap.fee && (select.includes(`fee`) || !select.length)) {
        const feeInfo = this.getFeeInfo(swap);
        swap.fee = feeInfo.fee;
        swap.feeSymbol = feeInfo.symbol;
        swap.feeUsd = await this.metadataSrv.tryToUsd(network, swap.fee, feeInfo.address);
      }

      if (swap.payRouterRequest) {
        swap.payRouterRequest.routes = [];

        const routeIds = swap.payRouterRequest.routeIds;
        for (const routeId of routeIds) {
          const route = await PayRouterRoute.findByNetworkAndRouteId(network, routeId, 'paymentMethod');
          if (route) swap.payRouterRequest.routes.push(route);
        }
      }

      // Get the exchange rates for the payment methods involved in the swap
      const rates: Record<string, number> = {};
      if (swap.providerPaymentMethod) {
        const currency = getCurrency(swap.providerPaymentMethod.name);
        const rate = await this.exrSrv.get(currency);
        rates[currency] = rate.toNumber();
      }
      if (swap.takerPaymentMethod) {
        const currency = getCurrency(swap.takerPaymentMethod.name);
        const rate = await this.exrSrv.get(currency);
        rates[currency] = rate.toNumber();
      }
      if (swap.payRouterRequest) {
        for (const route of swap.payRouterRequest.routes) {
          if (route.paymentMethod) {
            const currency = getCurrency(route.paymentMethod.name);
            const rate = await this.exrSrv.get(currency);
            rates[currency] = rate.toNumber();
          }
        }
      }
      swap.rates = rates;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Returns fee info for a swap
   * @param swap The swap object
   */
  getFeeInfo(swap: Swap) {
    const info: { symbol: string; fee: string; address: string } = { symbol: '', fee: '', address: '' };
    const { baseType, quoteType, base, quote, baseAddress, quoteAddress } = swap.market;

    // ERC20/ERC20, ERC20/SYNTH
    if (
      (Market.isERC20(baseType) && Market.isERC20(quoteType)) ||
      (Market.isERC20(baseType) && Market.isSynth(quoteType))
    ) {
      info.symbol = base;
      info.fee = toDec(swap.marketCreatorFee).add(swap.protocolFee).toFixed();
      info.address = baseAddress;
    }

    // SYNTH/ERC20
    if (Market.isSynth(baseType) && Market.isERC20(quoteType)) {
      info.symbol = quote;
      info.fee = toDec(swap.marketCreatorFee).add(swap.protocolFee).toFixed();
      info.address = quoteAddress;
    }

    // SYNTH/SYNTH
    if (Market.isSynth(baseType) && Market.isSynth(quoteType)) {
      info.symbol = 'JOIN';
      info.fee = toDec(swap.marketCreatorFee).add(swap.protocolFee).toFixed();
      info.address = getContractsAddress(swap.network, 'token');
    }

    return info;
  }

  /**
   * Get a list of user IDs allowed to create messages for a given swap.
   * Only provider, taker and current dispute draftees are allowed.
   * @param swap The swap object
   * @param includeAllDisputes If true, re-disputes draftees are also added as participants.
   */
  async getParticipants(swap: Swap, includeAllDisputes = false): Promise<string[]> {
    const { provider, taker, network, marketAddress, orderId } = swap;
    const participants = [provider, taker];

    // Get current dispute draftees
    const dispute = await Dispute.getRecentOfOrder(network, marketAddress, orderId);
    if (dispute) {
      const draftees = await Draft.getAll(network, marketAddress, orderId, dispute.disputeId);
      draftees.forEach((draftee) => participants.push(draftee.owner));

      if (includeAllDisputes && dispute.disputeId > 0) {
        for (let i = 0; i < dispute.disputeId; i++) {
          const draftees = await Draft.getAll(network, marketAddress, orderId, i);
          draftees.forEach((draftee) => {
            participants.push(draftee.owner);
          });
        }
      }
    }

    const participantsId = [];
    for (const participant of participants) {
      const user = await User.getByAddress(participant);
      if (user) participantsId.push(user.id);
    }

    return Promise.resolve(_.uniq(participantsId));
  }

  /**
   * Get the dispute delay duration for a swap.
   * Tries to see if there is a market-level dispute delay duration set,
   * otherwise returns the indexer's default value or a hardcoded default value.
   * @param swap The swap object
   * @returns The dispute delay duration in seconds
   */
  async getDisputeDelayDur(swap: Swap): Promise<number> {
    const { market, network } = swap;
    const metaKey = Meta.makeNetKey(network, MetaKeys.DisputeDelayDur);
    const values = (await Meta.getJSON(metaKey)) || {};
    const marketDisputeDelayDur = values[market.address];
    return marketDisputeDelayDur || parseInt(this.cfgSrv.get('app.defaultDisputeDelayDur') || '300');
  }
}

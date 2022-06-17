import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata.service';
import * as moment from 'moment';
import MarketPrice from '../../models/market_price';
import { ToDec } from '../../common/common';
import Swap from '../../models/swaps';

@Injectable()
export class MarketsService {
  constructor(private netSrv: NetworkService, private metadataSrv: MetadataService) {}

  /**
   * Returns normalized JSON equivalent of a market object sourced
   * from the MarketCore contract.
   * @param market
   */
  normalizeMarket(market: any): ContractMarket {
    return {
      creator: market.creator,
      createdAt: market.createdAt?.toNumber(),
      baseAsset: {
        addr: market.base?.addr,
        isLocal: market.base?.isLocal,
      },
      quoteAsset: {
        addr: market.quote?.addr,
        isLocal: market.quote?.isLocal,
      },
      numOrders: market.numOrders?.toNumber(),
      numDisputes: market.numDisputes?.toNumber(),
      permPut: market.permPut,
      permSwap: market.permSwap,
      permMediate: market.permMediate,
      commission: market.commission?.toNumber(),
      numMediators: market.numMediators?.toNumber(),
      mediatorBond: market.mediatorBond?.toString(),
    };
  }

  /**
   * Merge markets sources into the DB market type
   * @param cMarketSource The market from the MarketCore contract
   * @param dbMarket The market from the database
   */
  merge(cMarketSource: ContractMarket, dbMarket: Market) {
    _.extend(dbMarket, _.omit(cMarketSource, ['baseAsset', 'quoteAsset', 'createdAt']));
  }

  /**
   * Extend a DB-sourced market with other market information
   * @param market The DB-sourced market
   * @param noMerge Indicate whether to merge in contract-sourced market.
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendMarket(market: Market, noMerge = false, select = []) {
    try {
      const { marketId, network: net, base, baseAddress, quote, quoteAddress } = market;

      if (!noMerge) {
        const _m = await (await this.netSrv.getMarketCore(net)).markets(market.marketId);
        const marketFromContract = this.normalizeMarket(_m);
        this.merge(marketFromContract, market);
      }

      if (select.includes(`numProviders`) || !select.length)
        market.numProviders = await Liquidity.countProvidersInMarket(net, marketId);
      if (select.includes(`totalLiquidity`) || !select.length)
        market.totalLiquidity = await Liquidity.getTotalMarketLiquidity(net, marketId);
      if (select.includes(`lowestPrice`) || !select.length)
        market.lowestPrice = await Liquidity.getLowestPriceInMarket(net, marketId);
      if (select.includes(`highestPrice`) || !select.length)
        market.highestPrice = await Liquidity.getHighestPriceInMarket(net, marketId);
      if (select.includes(`totalSwaps`) || !select.length)
        market.totalSwaps = await Swap.countByNetworkAndMarket(net, marketId);
      if (select.includes(`totalInstantSwaps`) || !select.length)
        market.totalInstantSwaps = await Swap.countByNetworkAndMarket(net, marketId, true);
      if (select.includes(`totalSwaps24h`) || !select.length)
        market.totalSwaps24h = await Swap.countByNetworkAndMarket(net, marketId, undefined, 1440);
      if (select.includes(`totalInstantSwaps24h`) || !select.length)
        market.totalInstantSwaps24h = await Swap.countByNetworkAndMarket(net, marketId, true, 1440);
      if (select.includes(`volume24h`) || !select.length)
        market.volume24h = await Swap.getMarketVolume(net, marketId, 1400);
      if (select.includes(`volumeInstant24h`) || !select.length)
        market.volumeInstant24h = await Swap.getMarketVolume(net, marketId, 1400, true);
      if (select.includes(`baseLogo`) || !select.length)
        market.baseLogo = await this.metadataSrv.getLogo(base, baseAddress);
      if (select.includes(`quoteLogo`) || !select.length)
        market.quoteLogo = await this.metadataSrv.getLogo(quote, quoteAddress);
      if (select.includes(`priceChange`) || !select.length)
        market.priceChange = await this.priceChange(net, marketId, 24);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get hourly price change for a market
   * @param net The network name
   * @param mid The market ID
   * @param hours The price change period in hours
   */
  async priceChange(net: string, mid: string, hours: number): Promise<number> {
    const timeAgo = moment().subtract(hours, 'h').toISOString();
    const priceHourAgo = await MarketPrice.findRecentBefore(net, mid, timeAgo);
    if (!priceHourAgo) return Promise.resolve(0);
    const currentPrice = await MarketPrice.findRecent(net, mid);
    return Promise.resolve(
      ToDec(currentPrice.price)
        .sub(priceHourAgo.price)
        .div(ToDec(priceHourAgo.price))
        .mul(100)
        .toNumber(),
    );
  }
}

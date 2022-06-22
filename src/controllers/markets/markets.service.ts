import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import NetworkService from '../../network/network.service';
import MarketPrice from '../../models/market_price';
import Swap from '../../models/swap';
import { getTokenLogo } from '../../common/token_list';

@Injectable()
export class MarketsService {
  constructor(private netSrv: NetworkService) {}

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
      const { marketId, network: net, baseAddress, quoteAddress } = market;

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
        market.totalSwaps = await Swap.countByNetworkAndMarketAndProvider(net, marketId, undefined);
      if (select.includes(`totalInstantSwaps`) || !select.length)
        market.totalInstantSwaps = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          undefined,
          true,
        );
      if (select.includes(`totalSwaps24h`) || !select.length)
        market.totalSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          undefined,
          undefined,
          1440,
        );
      if (select.includes(`totalInstantSwaps24h`) || !select.length)
        market.totalInstantSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          undefined,
          true,
          1440,
        );
      if (select.includes(`volume24h`) || !select.length)
        market.volume24h = await Swap.getVolume(net, marketId, undefined, 1400);
      if (select.includes(`volumeInstant24h`) || !select.length)
        market.volumeInstant24h = await Swap.getVolume(net, marketId, undefined, 1400, true);
      if (select.includes(`priceChange`) || !select.length)
        market.priceChange = await MarketPrice.priceChange(net, marketId, undefined, 24);
      if (select.includes(`baseLogo`) || !select.length)
        market.baseLogo = getTokenLogo(baseAddress);
      if (select.includes(`quoteLogo`) || !select.length)
        market.quoteLogo = getTokenLogo(quoteAddress);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

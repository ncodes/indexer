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
      numDisputes: market.numDisputes?.toNumber(),
      commission: market.commission?.toNumber(),
      numMediators: market.numMediators?.toNumber(),
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
      const { address, network: net, baseAddress, quoteAddress } = market;

      if (!noMerge) {
        const _m = await (await this.netSrv.getMarketCore(net)).markets(market.address);
        let marketFromContract = this.normalizeMarket(_m);
        if (select.length) marketFromContract = _.pick(marketFromContract, select) as any;
        this.merge(marketFromContract, market);
      }

      if (select.includes(`numProviders`) || !select.length)
        market.numProviders = await Liquidity.countProvidersInMarket(net, address);
      if (select.includes(`totalLiquidity`) || !select.length)
        market.totalLiquidity = await Liquidity.getTotalMarketLiquidity(net, address);
      market.lowestPrice = await Liquidity.getLowestPrice(net, address, undefined);
      if (select.includes(`lowestPrice24h`) || !select.length)
        market.lowestPrice24h = await Liquidity.getLowestPrice(net, address, undefined, 24);
      if (select.includes(`highestPrice24h`) || !select.length)
        market.highestPrice24h = await Liquidity.getHighestPrice(net, address, undefined, 24);
      if (select.includes(`totalSwaps24h`) || !select.length)
        market.totalSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          address,
          undefined,
          market.isInstant(),
          1440,
        );
      if (select.includes(`volume24h`) || !select.length)
        market.volume24h = await Swap.getVolume(
          net,
          address,
          undefined,
          undefined,
          1400,
          market.isInstant(),
        );
      if (select.includes(`priceChange`) || !select.length)
        market.priceChange = await MarketPrice.priceChange(net, address, undefined, 24);
      if (select.includes(`baseLogo`) || !select.length)
        market.baseLogo = getTokenLogo(net, baseAddress);
      if (select.includes(`quoteLogo`) || !select.length)
        market.quoteLogo = getTokenLogo(net, quoteAddress);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

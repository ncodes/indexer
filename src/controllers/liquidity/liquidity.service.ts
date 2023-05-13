import { Injectable } from '@nestjs/common';
import NetworkService from '../../network/network.service';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import { MarketsService } from '../markets/markets.service';
import Swap from '../../models/swap';
import MarketPrice from '../../models/market_price';

@Injectable()
export class LiquidityService {
  constructor(private netSrv: NetworkService, private marketSrv: MarketsService) {}

  /**
   * Extend a DB-sourced liquidity with other liquidity information
   * @param liq The db-sourced liquidity
   * @param noMerge Indicate whether to fetch and merge in contract-sourced objects info.
   * @param select Select the extended field to be returned
   * @param noMarket No fetching of market info
   * @returns
   */
  async extendLiquidity(liq: Liquidity, noMerge = false, select = [], noMarket = false) {
    try {
      const { marketAddress, network: net, provider } = liq;
      const market = await Market.getMarket(net, marketAddress, select);
      if (!market) return Promise.reject(new Error('market not found'));
      if (select.includes(`totalSwaps24h`) || !select.length)
        liq.totalSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketAddress,
          provider,
          market.isInstant(),
          1440,
        );
      if (select.includes(`volume24h`) || !select.length)
        liq.volume24h = await Swap.getVolume(
          net,
          marketAddress,
          undefined,
          provider,
          1400,
          market.isInstant(),
        );
      if (select.includes(`priceChange`) || !select.length)
        liq.priceChange = await MarketPrice.priceChange(net, marketAddress, provider, 24);

      // Get market, extend it and assign to liquidity
      if (!noMarket) {
        await this.marketSrv.extendMarket(market, noMerge, select);
        liq.market = market;
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

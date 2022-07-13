import { Injectable } from '@nestjs/common';
import NetworkService from '../../network/network.service';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import * as _ from 'lodash';
import { MarketsService } from '../markets/markets.service';
import Swap from '../../models/swap';
import MarketPrice from '../../models/market_price';

@Injectable()
export class LiquidityService {
  constructor(private netSrv: NetworkService, private marketSrv: MarketsService) {}

  /**
   * Merge markets sources into the DB market type
   * @param cLiqSource The liquidity object from the Core contract
   * @param dbLiq The liquidity object from the database
   */
  merge(cLiqSource: { [k: string]: any }, dbLiq: Liquidity) {
    _.extend(dbLiq, _.omit(cLiqSource, []));
  }

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
      const { marketId, network: net, provider } = liq;
      if (!noMerge) {
        const contract = this.netSrv.getCore(net);
        const cLiq: ContractLiquidity = await contract.getLiquidity(marketId, provider);
        let cLiqPart = {
          openOrders: cLiq.openOrders.toNumber(),
          paused: cLiq.paused,
        };
        if (select.length) cLiqPart = _.pick(cLiqPart, select) as any;
        this.merge(cLiqPart, liq);
      }

      const market = await Market.getMarket(net, marketId, select);
      if (!market) return Promise.reject(new Error('market not found'));

      if (select.includes(`totalSwaps24h`) || !select.length)
        liq.totalSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          provider,
          market.isInstant(),
          1440,
        );
      if (select.includes(`volume24h`) || !select.length)
        liq.volume24h = await Swap.getVolume(net, marketId, provider, 1400, market.isInstant());
      if (select.includes(`priceChange`) || !select.length)
        liq.priceChange = await MarketPrice.priceChange(net, marketId, provider, 24);

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

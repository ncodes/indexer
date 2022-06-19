import { Injectable } from '@nestjs/common';
import NetworkService from '../../network/network.service';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import * as _ from 'lodash';
import { MarketsService } from '../markets/markets.service';
import Swap from '../../models/swaps';

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
   * @returns
   */
  async extendLiquidity(liq: Liquidity, noMerge = false, select = []) {
    try {
      const { marketId, network: net, provider } = liq;
      if (!noMerge) {
        const c: ContractLiquidity = await (
          await this.netSrv.getCore(net)
        ).getLiquidity(marketId, provider);
        this.merge(
          {
            openOrders: c.openOrders.toNumber(),
            paused: c.paused,
          },
          liq,
        );
      }

      if (select.includes(`totalSwaps`) || !select.length)
        liq.totalSwaps = await Swap.countByNetworkAndMarketAndProvider(net, marketId, provider);
      if (select.includes(`totalInstantSwaps`) || !select.length)
        liq.totalInstantSwaps = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          provider,
          true,
        );
      if (select.includes(`totalSwaps24h`) || !select.length)
        liq.totalSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          provider,
          undefined,
          1440,
        );
      if (select.includes(`totalInstantSwaps24h`) || !select.length)
        liq.totalInstantSwaps24h = await Swap.countByNetworkAndMarketAndProvider(
          net,
          marketId,
          provider,
          true,
          1440,
        );
      if (select.includes(`volume24h`) || !select.length)
        liq.volume24h = await Swap.getVolume(net, marketId, provider, 1400);
      if (select.includes(`volumeInstant24h`) || !select.length)
        liq.volumeInstant24h = await Swap.getVolume(net, marketId, provider, 1400, true);

      // Get market, extend it and assign to liquidity
      const market = await Market.getMarket(net, marketId);
      if (!market) return Promise.reject(new Error('market not found'));
      await this.marketSrv.extendMarket(market, noMerge);
      liq.market = market;
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

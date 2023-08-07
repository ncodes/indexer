import { Injectable } from '@nestjs/common';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import { MarketService } from '../markets/market.service';
import Swap from '../../models/swap';
import MarketPrice from '../../models/market_price';
import * as _ from 'lodash';

@Injectable()
export class LiquidityService {
  constructor(private marketSrv: MarketService) {}

  /**
   * Extend liquidity with peripheral and derived data
   * @param liq The db-sourced liquidity
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendLiquidity(liq: Liquidity, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    try {
      const { marketAddress, network: net, provider } = liq;

      let market: Market;
      if (select.includes(`market`) || !select.length) {
        market = await Market.getMarket(net, marketAddress, select, undefined);
        if (!market) return Promise.reject(new Error('market not found'));
        await this.marketSrv.extendMarket(market, select);
        liq.market = market;
      }

      if (select.includes(`totalSwaps24h`) || !select.length) {
        liq.totalSwaps24h = await Swap.countLiquiditySwaps(net, marketAddress, provider, liq.lid, undefined, 1440);
      }

      if (select.includes(`volume24h`) || !select.length) {
        liq.volume24h = await Swap.getVolume(net, marketAddress, undefined, provider, liq.lid, 1400, undefined);
      }

      if (select.includes(`priceChange`) || !select.length) {
        liq.priceChange = await MarketPrice.priceChange(net, marketAddress, provider, liq.lid, 24);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

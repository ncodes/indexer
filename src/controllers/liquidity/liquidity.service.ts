import { Injectable } from '@nestjs/common';
import Liquidity from '../../models/liquidity';
import Swap from '../../models/swap';
import MarketPrice from '../../models/market_price';
import * as _ from 'lodash';
import { MetadataService } from '../../services/metadata/metadata.service';
import { isZero } from '../../network/common';

@Injectable()
export class LiquidityService {
  constructor(private metadataSrv: MetadataService) {}

  /**
   * Extend liquidity with peripheral and derived data
   * @param liq The db-sourced liquidity
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendLiquidity(liq: Liquidity, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    try {
      const { marketAddress, network: net, provider, quoteAddress } = liq;

      if (select.includes(`totalSwaps24h`) || !select.length) {
        liq.totalSwaps24h = await Swap.countLiquiditySwaps(net, marketAddress, provider, liq.lid, undefined, 1440);
      }

      if (select.includes(`volume24h`) || !select.length) {
        liq.volume24h = await Swap.getVolume(net, marketAddress, undefined, provider, liq.lid, 1400, undefined, true);
      }

      if (select.includes(`priceChange`) || !select.length) {
        liq.priceChange = await MarketPrice.priceChange(net, marketAddress, provider, liq.lid, 24);
      }

      if ((select.includes(`priceUsd`) && !isZero(liq.price)) || !select.length) {
        liq.priceUsd = await this.metadataSrv.tryToUsd(net, liq.price, quoteAddress);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

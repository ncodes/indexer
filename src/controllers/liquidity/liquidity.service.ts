import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';
import OnlineStatus from '../../models/online_status';
import Swap from '../../models/swap';
import { isZero } from '../../network/common';
import { MetadataService } from '../../services/metadata/metadata.service';

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
      const { marketAddress, network: net, provider, baseAddress, quoteAddress } = liq;

      if (select.includes(`totalSwaps24h`) || !select.length) {
        liq.totalSwaps24h = await Swap.countLiquiditySwaps(net, marketAddress, provider, liq.lid, undefined, 1440);
      }

      if (select.includes(`volume24h`) || !select.length) {
        liq.volume24h = await Swap.getVolume(
          net,
          marketAddress,
          undefined,
          provider,
          undefined,
          liq.lid,
          1400,
          undefined,
          true,
        );
      }

      if (select.includes(`priceChange`) || !select.length) {
        liq.priceChange = await MarketPrice.priceChange(net, marketAddress, provider, liq.lid, 24);
      }

      if (!liq.priceUsd && ((select.includes(`priceUsd`) && !isZero(liq.price)) || !select.length)) {
        liq.priceUsd = await this.metadataSrv.tryToUsd(net, liq.price, quoteAddress);
      }

      if (!liq.amountUsd && ((select.includes(`amountUsd`) && !isZero(liq.amount)) || !select.length)) {
        liq.amountUsd = await this.metadataSrv.tryToUsd(net, liq.amount, baseAddress);
      }

      if (!liq.minSwapUsd && ((select.includes(`minSwapUsd`) && !isZero(liq.minSwap)) || !select.length)) {
        liq.minSwapUsd = await this.metadataSrv.tryToUsd(net, liq.minSwap, baseAddress);
      }

      if (!liq.maxSwapUsd && ((select.includes(`maxSwapUsd`) && !isZero(liq.maxSwap)) || !select.length)) {
        liq.maxSwapUsd = await this.metadataSrv.tryToUsd(net, liq.maxSwap, baseAddress);
      }

      if (!liq.lastTimeOnline && ((select.includes(`lastTimeOnline`) && !isZero(liq.maxSwap)) || !select.length)) {
        console.log(await OnlineStatus.isLastTimeOnline(net, provider));
        liq.online = await OnlineStatus.isOnline(net, provider);
        liq.lastTimeOnline = await OnlineStatus.isLastTimeOnline(net, provider);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

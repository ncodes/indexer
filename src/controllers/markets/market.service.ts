import { Injectable } from '@nestjs/common';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Swap from '../../models/swap';
import { getTokenLogo } from '../../common/token_list';
import * as _ from 'lodash';
import { MetadataService } from '../../services/metadata/metadata.service';
import { pow10D } from '../../network/common';
import { toDec } from '../../common/common';

@Injectable()
export class MarketService {
  constructor(private metadataSrv: MetadataService) {}

  /**
   * Extend a market with other peripheral and aggregated data
   * @param market The market object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendMarket(market: Market, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    try {
      const { address, network: net, baseAddress, quoteAddress } = market;
      if (select.includes(`numProviders`) || !select.length) {
        market.numProviders = await Liquidity.countProvidersInMarket(net, address);
      }

      market.lowestPrice = await Liquidity.getLowestPrice(net, address, undefined);
      if (select.includes(`lowestPrice24h`) || !select.length) {
        market.lowestPrice24h = await Liquidity.getLowestPrice(net, address, undefined, 24);
      }

      if (market.lowestPrice && market.lowestPrice !== '0') {
        const quoteInfo = await this.metadataSrv.getTokenInfo(net, market.quoteAddress);
        market.lowestPriceUsd = toDec(market.lowestPrice)
          .div(pow10D(quoteInfo.decimals))
          .mul(quoteInfo.price)
          .toNumber();
      } else {
        market.lowestPriceUsd = 0;
      }

      if (select.includes(`highestPrice24h`) || !select.length) {
        market.highestPrice24h = await Liquidity.getHighestPrice(net, address, undefined, 24);
      }

      if (select.includes(`totalSwaps24h`) || !select.length) {
        market.totalSwaps24h = await Swap.countLiquiditySwaps(
          net,
          address,
          undefined,
          undefined,
          market.isInstant(),
          1440,
        );
      }

      if (select.includes(`volume24h`) || !select.length) {
        market.volume24h = await Swap.getVolume(
          net,
          address,
          undefined,
          undefined,
          undefined,
          1440,
          market.isInstant(),
        );
      }

      if (select.includes(`priceChange`) || !select.length) {
        market.priceChange = await MarketPrice.priceChange(net, address, undefined, undefined, 24);
      }

      if (select.includes(`baseLogo`) || !select.length) {
        market.baseLogo = getTokenLogo(net, baseAddress);
        market.baseLogo = !market.baseLogo ? await this.metadataSrv.getTokenLogo(net, baseAddress) : market.baseLogo;
      }

      if (select.includes(`quoteLogo`) || !select.length) {
        market.quoteLogo = getTokenLogo(net, quoteAddress);
        market.quoteLogo = !market.quoteLogo ? await this.metadataSrv.getTokenLogo(net, baseAddress) : market.quoteLogo;
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

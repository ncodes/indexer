import { Injectable } from '@nestjs/common';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Swap from '../../models/swap';
import * as _ from 'lodash';
import { MetadataService } from '../../services/metadata/metadata.service';

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
      let baseInfo: TokenMetadata, quoteInfo: TokenMetadata;
      const { address, network: net, baseAddress, quoteAddress, totalLiquidity, lowestPrice } = market;

      if (select.includes(`numProviders`) || !select.length) {
        market.numProviders = await Liquidity.countProvidersInMarket(net, address);
      }

      if (select.includes(`lowestPrice24h`) || !select.length) {
        market.lowestPrice24h = await Liquidity.getLowestPrice(net, address, undefined, 24);
      }

      if (select.includes(`highestPrice24h`) || !select.length) {
        market.highestPrice24h = await Liquidity.getHighestPrice(net, address, undefined, 24);
      }

      if (!market.lowestPriceUsd && (select.includes(`lowestPrice`) || !select.length)) {
        quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
        market.lowestPriceUsd = await this.metadataSrv.tryToUsd(net, lowestPrice, quoteAddress, quoteInfo);
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
          undefined,
          1440,
          market.isInstant(),
          true,
        );
      }

      if (select.includes(`priceChange`) || !select.length) {
        market.priceChange = await MarketPrice.priceChange(net, address, undefined, undefined, 24);
      }

      if (select.includes(`baseLogo`) || !select.length) {
        baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
        market.baseLogo = baseInfo.logoURI;
      }

      if (select.includes(`quoteLogo`) || !select.length) {
        quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
        market.quoteLogo = quoteInfo.logoURI;
      }

      if (select.includes(`amountSwapped`) || !select.length) {
        baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
        market.amountSwappedUsd = await this.metadataSrv.tryToUsd(
          net,
          market.amountSwapped,
          market.baseAddress,
          baseInfo,
        );
      }

      if (!market.totalLiquidityUsd && (select.includes(`totalLiquidity`) || !select.length)) {
        baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
        market.totalLiquidityUsd = await this.metadataSrv.tryToUsd(net, totalLiquidity, baseAddress, baseInfo);
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

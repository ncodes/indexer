import { Injectable, Logger } from '@nestjs/common';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Swap from '../../models/swap';
import * as _ from 'lodash';
import { MetadataService } from '../../services/metadata/metadata.service';
import { handleAxiosError } from '../../common/errors/http_response_error';

@Injectable()
export class MarketService {
  logger = new Logger(MarketService.name);

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
        try {
          quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
          market.lowestPriceUsd = await this.metadataSrv.tryToUsd(net, lowestPrice, quoteAddress, quoteInfo);
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress, handleAxiosError(e).message);
        }
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
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          market.baseLogo = baseInfo.logoURI;
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress, handleAxiosError(e).message);
        }
      }

      if (select.includes(`quoteLogo`) || !select.length) {
        try {
          quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
          market.quoteLogo = quoteInfo.logoURI;
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress, handleAxiosError(e).message);
        }
      }

      if (select.includes(`amountSwapped`) || !select.length) {
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          market.amountSwappedUsd = await this.metadataSrv.tryToUsd(
            net,
            market.amountSwapped,
            market.baseAddress,
            baseInfo,
          );
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress, handleAxiosError(e).message);
        }
      }

      if (!market.totalLiquidityUsd && (select.includes(`totalLiquidity`) || !select.length)) {
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          market.totalLiquidityUsd = await this.metadataSrv.tryToUsd(net, totalLiquidity, baseAddress, baseInfo);
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + baseAddress);
        }
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

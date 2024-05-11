import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import Market from '../../models/market';
import { Base } from '../base';
import { MetadataService } from './../../services/metadata/metadata.service';

/**
 * MarketMetaManager manages market meta data
 */
@Injectable()
export default class MarketMetaManager extends Base {
  private logger = new Logger(MarketMetaManager.name);

  constructor(private metadataSrv: MetadataService) {
    super();
    this.schedule();
  }

  // Every 10 seconds
  @Cron('*/60 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      // Find markets to update meta
      const timeAgo = moment().utc().subtract(60, 's');
      const markets = await Market.findMarketsToUpdateMeta(timeAgo.toISOString(), 1000);

      this.logger.log(`Found ${markets.length} markets to update meta`);

      for (let i = 0; i < markets.length; i++) {
        await Promise.all([
          await this.getLogoUrls(markets[i]),
          await this.getDecimals(markets[i]),
          await this.updatePrices(markets[i]),
        ])
          .then(() => {
            this.logger.log(`Successfully fetched all meta for market ${markets[i].id}`);
          })
          .catch((e) => {
            this.logger.error(`failed to update market ${markets[i].id} meta`, e);
          })
          .finally(async () => {
            await Market.updateById(markets[i].id, {
              baseLogo: markets[i].baseLogo,
              quoteLogo: markets[i].quoteLogo,
              baseDecimals: markets[i].baseDecimals,
              quoteDecimals: markets[i].quoteDecimals,
              basePriceUsd: markets[i].basePriceUsd,
              quotePriceUsd: markets[i].quotePriceUsd,
              lastMetaUpdatedAt: moment().utc().toISOString(),
            });
            this.logger.log(`Updated meta for market ${markets[i].id}`);
          });
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }

  async getLogoUrls(market: Market) {
    if (!market.baseLogo) {
      try {
        const tokenInfo = await this.metadataSrv.getTokenInfo(market.network, market.baseAddress);
        market.baseLogo = tokenInfo.logoURI;
      } catch (error) {
        this.logger.error('failed to fetch base token logo for market ' + market.baseAddress, error);
      }
    }

    if (!market.quoteLogo) {
      try {
        const tokenInfo = await this.metadataSrv.getTokenInfo(market.network, market.quoteAddress);
        market.quoteLogo = tokenInfo.logoURI;
      } catch (error) {
        this.logger.error(`failed to fetch quote token logo for market` + market.quoteAddress, error);
      }
    }
  }

  async getDecimals(market: Market) {
    if (!market.baseDecimals) {
      try {
        const tokenInfo = await this.metadataSrv.getTokenInfo(market.network, market.baseAddress);
        market.baseDecimals = tokenInfo.decimals;
      } catch (error) {
        this.logger.error('failed to fetch base token decimals for market ' + market.baseAddress, error);
      }
    }

    if (!market.quoteDecimals) {
      try {
        const tokenInfo = await this.metadataSrv.getTokenInfo(market.network, market.quoteAddress);
        market.quoteDecimals = tokenInfo.decimals;
      } catch (error) {
        this.logger.error('failed to fetch quote token decimals for market ' + market.quoteAddress, error);
      }
    }
  }

  async updatePrices(market: Market) {
    try {
      const baseInfo = await this.metadataSrv.getTokenInfo(market.network, market.baseAddress);
      market.basePriceUsd = baseInfo.price.toString();
    } catch (error) {
      this.logger.error('failed to fetch base token price for market ' + market.baseAddress, error);
    }

    try {
      const quoteInfo = await this.metadataSrv.getTokenInfo(market.network, market.quoteAddress);
      market.quotePriceUsd = quoteInfo.price.toString();
    } catch (error) {
      this.logger.error('failed to fetch quote token price for market ' + market.quoteAddress, error);
    }
  }
}

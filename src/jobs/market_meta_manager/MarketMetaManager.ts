import { getTokenInfo } from '@jointlabs/meta';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import Envs from '../../config/contants';
import Market from '../../models/market';
import { MetadataService } from '../../services/metadata/metadata.service';
import { Base } from '../base';

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

  @Cron(Envs.marketManagerCronTime)
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      // Find markets to update meta
      const timeAgo = moment().utc().subtract(60, 's');

      // TODO: Do not fetch markets with logo and decimals already set
      const markets = await Market.findMarketsToUpdateMeta(timeAgo.toISOString(), 1000);

      this.logger.log(`Found ${markets.length} markets to update meta`);

      for (let i = 0; i < markets.length; i++) {
        await Promise.all([await this.getLogoUrls(markets[i]), await this.getDecimals(markets[i])])
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

      // If no base logo, find it in local network token list.
      if (!market.baseLogo) {
        market.baseLogo = getTokenInfo(market.network, market.baseAddress)?.logoURI;
      }
    }

    if (!market.quoteLogo) {
      try {
        const tokenInfo = await this.metadataSrv.getTokenInfo(market.network, market.quoteAddress);
        market.quoteLogo = tokenInfo.logoURI;
      } catch (error) {
        this.logger.error(`failed to fetch quote token logo for market` + market.quoteAddress, error);
      }

      // If no quote logo, find it in local network token list.
      if (!market.quoteLogo) {
        market.quoteLogo = getTokenInfo(market.network, market.quoteAddress)?.logoURI;
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
}

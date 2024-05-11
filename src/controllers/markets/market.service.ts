import { getTokenInfo } from '@jointlabs/chains-info';
import { Injectable, Logger } from '@nestjs/common';
import * as _ from 'lodash';
import * as moment from 'moment';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Meta from '../../models/meta';
import Swap from '../../models/swap';
import { MetadataService } from '../../services/metadata/metadata.service';

const UnknownTokenLogoURL = 'https://storage.googleapis.com/joint-images/token-logos/unknown.svg';
@Injectable()
export class MarketService {
  logger = new Logger(MarketService.name);

  constructor(private metadataSrv: MetadataService) {}

  /**
   * Extend a market with other peripheral and aggregated data
   * @param mkt The market object
   * @param select Select the extended field to be returned
   * @returns
   */
  async extendMarket(mkt: Market, select = []) {
    select = select && _.filter(select, (s) => !_.isEmpty(s));
    try {
      let baseInfo: TokenMetadata, quoteInfo: TokenMetadata;
      const { address, network: net, baseAddress, quoteAddress, totalLiquidity, lowestPrice } = mkt;

      let now = moment();

      if (select.includes(`numProviders`) || !select.length) {
        mkt.numProviders = await Liquidity.countProvidersInMarket(net, address);
      }
      console.log('TimeCheck: NumProviders', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`lowestPrice24h`) || !select.length) {
        mkt.lowestPrice24h = await Liquidity.getLowestPrice(net, address, undefined, 24);
      }
      console.log('TimeCheck: LowestPrice24h', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`highestPrice24h`) || !select.length) {
        mkt.highestPrice24h = await Liquidity.getHighestPrice(net, address, undefined, 24);
      }
      console.log('TimeCheck: HighestPrice24h', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (!mkt.lowestPriceUsd && (select.includes(`lowestPrice`) || !select.length)) {
        try {
          quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
          mkt.lowestPriceUsd = await this.metadataSrv.tryToUsd(net, lowestPrice, quoteAddress, quoteInfo);
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress);
        }
      }
      console.log('TimeCheck: LowestPriceUsd', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`totalSwaps24h`) || !select.length) {
        mkt.totalSwaps24h = await Swap.countLiquiditySwaps(net, address, undefined, undefined, mkt.isInstant(), 1440);
      }
      console.log('TimeCheck: TotalSwaps24h', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`volume24h`) || !select.length) {
        mkt.volume24h = await Swap.getVolume(
          net,
          address,
          undefined,
          undefined,
          undefined,
          undefined,
          1440,
          mkt.isInstant(),
          true,
        );
      }
      console.log('TimeCheck: Volume24h', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`priceChange`) || !select.length) {
        mkt.priceChange = await MarketPrice.priceChange(net, address, undefined, undefined, 24);
      }
      console.log('TimeCheck: PriceChange', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`baseLogo`) || !select.length) {
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          mkt.baseLogo = baseInfo.logoURI;
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress);
        }

        // Try to find logo in local token list.
        if (!mkt.baseLogo) {
          const info = getTokenInfo(net, baseAddress);
          if (info) mkt.baseLogo = info.logoURI;
        }

        mkt.baseLogo = mkt.baseLogo || UnknownTokenLogoURL;
      }
      console.log('TimeCheck: BaseLogo', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`quoteLogo`) || !select.length) {
        try {
          quoteInfo = await this.metadataSrv.getTokenInfo(net, quoteAddress);
          mkt.quoteLogo = quoteInfo.logoURI;
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress);
        }

        // Try to find logo in local token list.
        if (!mkt.quoteLogo) {
          const info = getTokenInfo(net, quoteAddress);
          if (info) mkt.quoteLogo = info.logoURI;
        }

        mkt.quoteLogo = mkt.quoteLogo || UnknownTokenLogoURL;
      }
      console.log('TimeCheck: QuoteLogo', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (select.includes(`amountSwapped`) || !select.length) {
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          mkt.amountSwappedUsd = await this.metadataSrv.tryToUsd(net, mkt.amountSwapped, mkt.baseAddress, baseInfo);
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + quoteAddress);
        }
      }
      console.log('TimeCheck: AmountSwappedUsd', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (!mkt.totalLiquidityUsd && (select.includes(`totalLiquidity`) || !select.length)) {
        try {
          baseInfo = await this.metadataSrv.getTokenInfo(net, baseAddress);
          mkt.totalLiquidityUsd = await this.metadataSrv.tryToUsd(net, totalLiquidity, baseAddress, baseInfo);
        } catch (e) {
          this.logger.error('failed to fetch token info: ' + baseAddress);
        }
      }
      console.log('TimeCheck: TotalLiquidityUsd', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (!mkt.disputeDelayDur) {
        mkt.disputeDelayDur = await Meta.getContractParam(mkt.network, 'defaultDisputeDelayDur');
      }
      console.log('TimeCheck: DisputeDelayDur', moment().diff(now, 'ms'), 'ms');

      now = moment();
      if (!mkt.evidenceDur || !mkt.predictDur) {
        const poolParamKey = Meta.makeMediatorPoolKey(mkt.network, mkt.mediatorPoolId);
        const poolInfo = await Meta.getJSON<PoolParams>(poolParamKey);

        if (!mkt.evidenceDur) {
          mkt.evidenceDur = poolInfo.evidenceDur
            ? poolInfo.evidenceDur
            : await Meta.getContractParam(mkt.network, 'evidenceDur');
        }

        if (!mkt.predictDur) {
          mkt.predictDur = poolInfo.predictDur
            ? poolInfo.predictDur
            : await Meta.getContractParam(mkt.network, 'predictDur');
        }
      }
      console.log('TimeCheck: EvidenceDur, PredictDur', moment().diff(now, 'ms'), 'ms');

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

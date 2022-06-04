import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata.service';

@Injectable()
export class MarketsService {
  constructor(
    private netSrv: NetworkService,
    private metadataSrv: MetadataService,
  ) {}

  /**
   * Returns normalized JSON equivalent of a market object sourced
   * from the MarketCore contract.
   * @param market
   */
  normalizeMarket(market: any): ContractMarket {
    return {
      creator: market.creator,
      createdAt: market.createdAt.toNumber(),
      baseAsset: {
        addr: market.base.addr,
        isLocal: market.base.isLocal,
      },
      quoteAsset: {
        addr: market.quote.addr,
        isLocal: market.quote.isLocal,
      },
      numOrders: market.numOrders.toNumber(),
      numDisputes: market.numDisputes.toNumber(),
      permPut: market.permPut,
      permSwap: market.permSwap,
      permMediate: market.permMediate,
      commission: market.commission.toNumber(),
      numMediators: market.numMediators.toNumber(),
      mediatorBond: market.mediatorBond.toString(),
    };
  }

  /**
   * Merge markets sources into the DB market type
   * @param cMarketSource The market from the MarketCore contract
   * @param dbMarket The market from the database
   */
  merge(cMarketSource: ContractMarket, dbMarket: Market) {
    _.extend(
      dbMarket,
      _.omit(cMarketSource, ['baseAsset', 'quoteAsset', 'createdAt']),
    );
  }

  /**
   * Extend a DB-sourced market with other market information
   * @param market The DB-sourced market
   * @param noMerge Indicate whether to merge in contract-sourced market.
   * @returns
   */
  async extendMarket(market: Market, noMerge = false) {
    try {
      if (!noMerge) {
        const _m = await this.netSrv
          .getMarketCore(market.network)
          .markets(market.mid);
        const marketFromContract = this.normalizeMarket(_m);
        this.merge(marketFromContract, market);
      }

      market.numLiquidityProviders = await Liquidity.countProvidersInMarket(
        market.network,
        market.mid,
      );

      market.totalLiquidity = await Liquidity.getTotalMarketLiquidity(
        market.network,
        market.mid,
      );

      market.lowestPrice = await Liquidity.getLowestPriceInMarket(
        market.network,
        market.mid,
      );

      market.highestPrice = await Liquidity.getHighestPriceInMarket(
        market.network,
        market.mid,
      );

      market.baseLogo = await this.metadataSrv.getLogo(
        market.base,
        market.baseAddress,
      );

      market.quoteLogo = await this.metadataSrv.getLogo(
        market.quote,
        market.quoteAddress,
      );

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

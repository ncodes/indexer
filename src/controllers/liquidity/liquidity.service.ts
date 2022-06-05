import { Injectable } from '@nestjs/common';
import NetworkService from '../../network/network.service';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import * as _ from 'lodash';
import { MarketsService } from '../markets/markets.service';

@Injectable()
export class LiquidityService {
  constructor(
    private netSrv: NetworkService,
    private marketSrv: MarketsService,
  ) {}

  /**
   * Merge markets sources into the DB market type
   * @param cLiqSource The liquidity object from the Core contract
   * @param dbLiq The liquidity object from the database
   */
  merge(cLiqSource: { [k: string]: any }, dbLiq: Liquidity) {
    _.extend(dbLiq, _.omit(cLiqSource, []));
  }

  /**
   * Extend a DB-sourced liquidity with other liquidity information
   * @param liq The db-sourced liquidity
   * @param noMerge Indicate whether to fetch and merge in contract-sourced objects info.
   * @returns
   */
  async extendLiquidity(liq: Liquidity, noMerge = false) {
    try {
      if (!noMerge) {
        const liqFromContract: ContractLiquidity = await (
          await this.netSrv.getCore(liq.network)
        ).getLiquidity(liq.marketId, liq.provider);
        this.merge(
          {
            openOrders: liqFromContract.openOrders.toNumber(),
            paused: liqFromContract.paused,
          },
          liq,
        );
      }

      // Get market, extend it and assign to liquidity
      const market = await Market.getMarket(liq.network, liq.marketId);
      if (!market) return Promise.reject(new Error('market not found'));
      await this.marketSrv.extendMarket(market, noMerge);
      liq.market = market;
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

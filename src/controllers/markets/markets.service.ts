import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import Market from '../../models/market';

@Injectable()
export class MarketsService {
  /**
   * Returns JSON equivalent of a market object from the contract.
   * @param market
   */
  netMarketToJSON(market: any): ContractMarket {
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
   * @param marketFromContract The market from the MarketCore contract
   * @param source The market from the database
   */
  unifyMarkets(marketFromContract: ContractMarket, source: Market) {
    source.baseAddress = marketFromContract.baseAsset.addr;
    source.isBaseLocal = marketFromContract.baseAsset.isLocal;
    source.quoteAddress = marketFromContract.quoteAsset.addr;
    source.isQuoteLocal = marketFromContract.quoteAsset.isLocal;
    _.extend(
      source,
      _.omit(marketFromContract, ['baseAsset', 'quoteAsset', 'createdAt']),
    );
  }
}

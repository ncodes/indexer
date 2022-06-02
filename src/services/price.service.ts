/* tslint:disable:max-classes-per-file */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import Nomics from 'nomics';
import { ToDec } from '../common/common';

export interface AssetPrice {
  // unique id to represent symbol and conversion currency combination
  id: string;
  // asset symbol (e.g BTC)
  symbol: string;
  // asset price in the conversion currency
  price: string;
  // asset price change in percentage (interval=1d)
  priceChangePct: string;
  // the conversion currency
  convert: string;
}

@Injectable()
export class PriceService implements OnModuleInit {
  private readonly id: string; // used to identify the current instance
  private logger = new Logger(PriceService.name);
  client: PriceSource;

  constructor(private cfg: ConfigService) {
    this.id = randomStringGenerator();
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      this.client = new NomicsSource(this.cfg.get('app.nomics.key'));
    } catch (e) {
      this.logger.error(e.message);
    }
  }

  /**
   * getAssets returns details of one or more assets
   * @param tickers The ticker name of the assets
   * old cache value is used if available.
   * @param convert The currency to convert the asset price into (default=USD).
   */
  getAssets(tickers: string[], convert = 'USD'): Promise<AssetPrices> {
    return new Promise<AssetPrices>((resolve, reject) => {
      // Normalize tickers to upper case
      if (tickers.length) {
        tickers = tickers.map((value) => {
          return value.toUpperCase();
        });
      }

      this.client
        .get(tickers, convert.toUpperCase())
        .then((rates) => {
          return resolve(new AssetPrices(rates));
        })
        .catch((e) => {
          const msg = `failed to get assets price: ${e.statusText || e.message} (InstanceID: ${this.id})`; // prettier-ignore
          return reject(new Error(msg));
        });
    });
  }
}

export class AssetPrices {
  constructor(public prices: AssetPrice[]) {}

  get(symbol, convert = 'USD') {
    return this.prices.find((p) => {
      return (
        p.symbol.toUpperCase() === symbol.toUpperCase() &&
        p.convert.toUpperCase() === convert.toUpperCase()
      );
    });
  }
}

/**
 * NomicsSource implements PriceSource
 */
class NomicsSource implements PriceSource {
  client: Nomics;

  constructor(key: string) {
    this.client = new Nomics({ apiKey: key });
  }

  get(ids: string[], convert: string): Promise<AssetPrice[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await this.client.currenciesTicker({
          convert,
          ids,
          interval: ['1d'],
        });
        const rates = res.map((r) => {
          const sym = r.symbol.toUpperCase();
          return {
            price: r.price,
            symbol: sym,
            convert,
            priceChangePct: ToDec(r['1d']?.price_change_pct || 0)
              .mul(100)
              .toFixed(),
            id: `${sym}_${convert}`.toUpperCase(),
          };
        });
        return resolve(rates);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

abstract class PriceSource {
  abstract get(ids: string[], convert: string): Promise<AssetPrice[]>;
}

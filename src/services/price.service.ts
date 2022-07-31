/* tslint:disable:max-classes-per-file */
import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { ConfigService } from '@nestjs/config';
import Nomics from 'nomics';
import { ToDec } from '../common/common';
import * as moment from 'moment';
import { Moment } from 'moment';

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
      this.client = new NomicsSource(this.cfg.get('app.nomics.key'), 60);
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
  cache: { [key: string]: { value: AssetPrice; lastFetched: Moment } } = {};

  /**
   * Initialize the source
   * @param key The source provider API key
   * @param expireTime The number of seconds before an asset's cached price
   * expires
   */
  constructor(key: string, private expireTime: number) {
    this.client = new Nomics({ apiKey: key });
  }

  get(ids: string[], convert: string): Promise<AssetPrice[]> {
    const rates = [];

    // Filter out and collect non-expired rates
    ids = ids.filter((id) => {
      const cached = this.cache[id.toUpperCase()];
      if (!cached) return true;
      const expired = moment().diff(cached.lastFetched, 's').valueOf() >= this.expireTime;
      if (!expired) rates.push(cached.value);
      return expired;
    });

    return new Promise(async (resolve, reject) => {
      try {
        if (!ids.length) return resolve(rates);
        const res = await this.client.currenciesTicker({
          convert,
          ids,
          interval: ['1d'],
        });

        res.forEach((r) => {
          const sym = r.symbol.toUpperCase();
          const assetPrice = {
            price: r.price,
            symbol: sym,
            convert,
            priceChangePct: ToDec(r['1d']?.price_change_pct || 0)
              .mul(100)
              .toFixed(),
            id: `${sym}_${convert}`.toUpperCase(),
          };
          this.cache[sym] = { lastFetched: moment(), value: assetPrice };
          rates.push(assetPrice);
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

// tslint:disable-next-line:max-classes-per-file
@Module({
  providers: [PriceService, ConfigService],
  exports: [PriceService, ConfigService],
})
export class PriceServiceModule {}

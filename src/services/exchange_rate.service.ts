import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Decimal } from 'decimal.js';
import { toDec } from '../common/common';

interface Rates {
  [key: string]: number;
}

@Injectable()
export class ExchangeRateService {
  private rates: Rates;

  constructor(private cfgSrv: ConfigService) {}

  /**
   * Updates the rates
   * @returns
   */
  async updateCache(): Promise<Rates> {
    try {
      if (this.cfgSrv.get('app.exchangeRateSource') == 'openexchangerates') {
        const key = this.cfgSrv.get('app.openexchangerates.key');
        const url = `https://openexchangerates.org/api/latest.json?app_id=${key}`;
        const resp = await axios.get(url);
        this.rates = resp.data.rates;
      } else if (this.cfgSrv.get('app.exchangeRateSource') == 'fastforex') {
        const key = this.cfgSrv.get('app.fastforex.key');
        const url = `https://api.fastforex.io/fetch-all?api_key=${key}`;
        const resp = await axios.get(url);
        this.rates = resp.data.results;
      }
      return Promise.resolve(this.rates);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get the rate of a symbol
   * @param symbol The symbol (ex: USD, NGN)
   */
  async get(symbol: string): Promise<Decimal> {
    if (!this.rates) await this.updateCache();
    const rate = this.rates[symbol.toUpperCase()];
    if (!rate) return Promise.resolve(undefined);
    return Promise.resolve(toDec(rate));
  }

  /**
   * Like get but returns zero if symbol is not found
   * @param symbol The symbol (ex: USD, NGN)
   */
  async tryGet(symbol: string): Promise<Decimal> {
    try {
      return await this.get(symbol);
    } catch (error) {
      return Promise.resolve(toDec(0));
    }
  }
}

// tslint:disable-next-line:max-classes-per-file
@Module({
  providers: [ExchangeRateService, ConfigService],
  exports: [ExchangeRateService, ConfigService],
})
export class ExchangeRateServiceModule {}

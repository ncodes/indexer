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
      const resp = await axios.get(
        `https://openexchangerates.org/api/latest.json?app_id=${this.cfgSrv.get('app.openexchangerate.key')}`,
      );
      this.rates = resp.data.rates;
      return Promise.resolve(this.rates);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get the rate of a symbol
   * @param symbol The symbol (e.g USD, NGN)
   */
  async get(symbol: string): Promise<Decimal> {
    if (!this.rates) await this.updateCache();
    const rate = this.rates[symbol.toUpperCase()];
    if (!rate) return Promise.resolve(undefined);
    return Promise.resolve(toDec(rate));
  }
}

// tslint:disable-next-line:max-classes-per-file
@Module({
  providers: [ExchangeRateService, ConfigService],
  exports: [ExchangeRateService, ConfigService],
})
export class ExchangeRateServiceModule {}

import { Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Decimal } from 'decimal.js';
import { toDec } from '../common/common';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

interface Rates {
  [key: string]: number;
}

const REDIS_KEY = 'exchange_rate_service';

@Injectable()
export class ExchangeRateService {
  private logger = new Logger(ExchangeRateService.name);

  constructor(private cfgSrv: ConfigService, private redisSrv: RedisService) {}

  /**
   * Get the rates
   * @param rates The rates
   * @returns
   */
  async saveRates(rates: Rates) {
    return this.redisSrv.set(REDIS_KEY, JSON.stringify(rates));
  }

  /**
   * Get the rates
   * @returns
   */
  async getRates(): Promise<Rates> {
    const ratesStr = await this.redisSrv.get(REDIS_KEY);
    return Promise.resolve(JSON.parse(ratesStr));
  }

  /**
   * Updates the rates
   * @returns
   */
  async updateCache(): Promise<Rates> {
    try {
      let result: Rates;

      if (this.cfgSrv.get('app.exchangeRateSource') == 'openexchangerates') {
        const key = this.cfgSrv.get('app.openexchangerates.key');
        const url = `https://openexchangerates.org/api/latest.json?app_id=${key}`;
        const resp = await axios.get(url);
        result = resp.data.rates;
        this.saveRates(result);
      } else if (this.cfgSrv.get('app.exchangeRateSource') == 'fastforex') {
        const key = this.cfgSrv.get('app.fastforex.key');
        const url = `https://api.fastforex.io/fetch-all?api_key=${key}`;
        const resp = await axios.get(url);
        result = resp.data.results;
        this.saveRates(result);
      }

      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get the rate of a symbol
   * @param symbol The symbol (ex: USD, NGN)
   */
  async get(symbol: string): Promise<Decimal> {
    let rates = await this.getRates();
    if (!rates) rates = await this.updateCache();

    if (!rates) await this.updateCache();
    const rate = rates[symbol.toUpperCase()];

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
      this.logger.error(axios.isAxiosError(error) ? error.response.data : error, error.stack, ExchangeRateService.name);
      return Promise.resolve(toDec(0));
    }
  }
}

// tslint:disable-next-line:max-classes-per-file
@Module({
  imports: [RedisModule],
  providers: [ExchangeRateService, ConfigService],
  exports: [ExchangeRateService, ConfigService],
})
export class ExchangeRateServiceModule {}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import fetch from 'node-fetch';
import Nomics from 'nomics';

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  constructor(private cfg: ConfigService) {
    // this.source = new NomicsMetadata(cfg.get('app.nomics.key'));
    this.source = new CoinMarketCapMetadata(cfg.get('app.cmc.key'));
  }

  /**
   * Get an asset's logo link
   * @param symbol
   * @returns
   */
  async getLogo(symbol: string, contract: string): Promise<string> {
    return this.source.getLogo(symbol, contract);
  }
}

// tslint:disable-next-line:max-classes-per-file
class NomicsMetadata {
  private client: Nomics;

  constructor(key: string) {
    this.client = new Nomics({ apiKey: key });
  }

  async getLogo(symbol: string, contract: string): Promise<string> {
    const tickers = await this.client.currenciesTicker({
      ids: [symbol.toUpperCase()],
      interval: ['1d'],
    });
    if (!tickers.length) return Promise.resolve(undefined);
    return Promise.resolve(tickers[0].logo_url);
  }
}

// tslint:disable-next-line:max-classes-per-file
class CoinMarketCapMetadata {
  constructor(private key: string) {}

  /**
   * Get logo url of contract
   * @param symbol The asset symbol
   * @param contract The asset contract
   * @returns
   */
  async getLogo(symbol: string, contract: string): Promise<string> {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?CMC_PRO_API_KEY=${this.key}&address=${contract}`;
    const resp = await fetch(url);
    const body = await resp.json();
    if (!body.data) return Promise.resolve(undefined);
    return Promise.resolve(_.values(body.data)[0].logo);
  }
}

// tslint:disable-next-line:max-classes-per-file
abstract class MetadataSource {
  abstract getLogo(symbol: string, contract: string): Promise<string>;
}

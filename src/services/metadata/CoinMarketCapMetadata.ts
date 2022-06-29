import fetch from 'node-fetch';
import * as _ from 'lodash';

export class CoinMarketCapMetadata {
  constructor(private key: string) {}

  /**
   * Get logo url of token
   * @param symbol The asset symbol
   * @param contract The asset contract
   * @returns
   */
  async getTokenLogo(symbol: string, contract: string): Promise<string> {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?CMC_PRO_API_KEY=${this.key}&address=${contract}`;
    const resp = await fetch(url);
    const body = await resp.json();
    if (!body.data) return Promise.resolve(undefined);
    return Promise.resolve(_.values(body.data)[0].logo);
  }

  getTokenInfo(symbol: string, contract: string): Promise<TokenInfo> {
    return Promise.reject(new Error('not implemented'));
  }
}

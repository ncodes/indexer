import * as _ from 'lodash';
import axios from 'axios';

export class CoinMarketCapMetadata {
  constructor(private key: string) {}

  async getPrice(id: number) {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?CMC_PRO_API_KEY=${this.key}&id=${id}`;
    const resp = await axios.get(url);
    const info = _.values(resp.data.data)[0];
    return Promise.resolve(info.quote.USD.price);
  }

  async getTokenInfo(network: string, contract: string): Promise<TokenInfo> {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?CMC_PRO_API_KEY=${this.key}&address=${contract}`;
    const resp = await axios.get(url);
    const info = _.values(resp.data.data)[0];
    const price = await this.getPrice(info.id);
    return Promise.resolve({
      network: network ? network : info.platform.slug,
      name: info.name,
      logoURI: info.logo,
      price,
      decimals: 0,
    });
  }
}

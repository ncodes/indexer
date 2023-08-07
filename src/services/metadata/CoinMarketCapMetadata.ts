import * as _ from 'lodash';
import axios from 'axios';
import { MetadataSource } from './metadata.service';

export class CoinMarketCapMetadata implements MetadataSource {
  constructor(private key: string) {}

  async getPrice(id: number) {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?CMC_PRO_API_KEY=${this.key}&id=${id}`;
    const resp = await axios.get(url);
    const info = _.values(resp.data.data)[0];
    return Promise.resolve(info.quote.USD.price);
  }

  /**
   * Get logo url of contract
   * @param network The asset network
   * @param symbolOrContract The asset contract address or symbol
   * @returns
   */
  async getTokenInfo(network: string, symbolOrContract: string): Promise<TokenMetadata> {
    const partUrl = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?CMC_PRO_API_KEY=${this.key}`;
    let url = `${partUrl}&address=${symbolOrContract}`;
    const isSymbol = !symbolOrContract.toLowerCase().startsWith('0x');
    url = isSymbol ? `${partUrl}&symbol=${symbolOrContract}` : url;
    const resp = await axios.get(url);
    const info = _.values(!isSymbol ? resp.data.data : resp.data.data[symbolOrContract.toUpperCase()])[0];
    const price = await this.getPrice(info.id);
    return Promise.resolve({
      network: network ? network : info?.platform?.slug,
      name: info.name,
      logoURI: info.logo,
      price,
      decimals: 0,
      isContract: !isSymbol,
    });
  }
}

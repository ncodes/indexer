// tslint:disable-next-line:max-classes-per-file
// @ts-ignore
import { getChainID } from '../../network/common';
import axios from 'axios';

export class CoinGeckoMetadata {
  private url = 'https://api.coingecko.com/api/v3';
  private proUrl = 'https://pro-api.coingecko.com/api/v3';
  networkMap = {
    ethereum: 'ethereum',
    binance: 'binance-smart-chain',
    optimism: 'optimistic-ethereum',
    polygon: 'polygon-pos',
  };

  async get(path: string, params: any = {}) {
    if (process.env.COINGECKO_KEY) this.url = this.proUrl;
    try {
      const resp = axios.get(`${this.url}/${path}`, {
        params: { x_cg_pro_api_key: process.env.COINGECKO_KEY, ...params },
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
      return Promise.resolve(resp);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Get logo url of contract
   * @param network The asset network
   * @param contract The asset contract
   * @returns
   */
  async getTokenInfo(network: string, contract: string): Promise<TokenInfo> {
    try {
      const resp = await this.get(`coins/${this.networkMap[network]}/contract/${contract}`, {});
      const data: CoinGecko.Asset = resp.data;
      return Promise.resolve({
        name: data.name,
        chainId: getChainID(network),
        network,
        address: contract,
        type: 'ERC20',
        decimals: data.detail_platforms[this.networkMap[network]].decimal_place,
        logoURI: data.image.large,
        price: data.market_data.current_price.usd,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

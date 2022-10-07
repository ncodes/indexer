// tslint:disable-next-line:max-classes-per-file
// @ts-ignore
import { getChainID } from '../../network/common';
import axios from 'axios';

const networkMap = {
  ethereum: 'ethereum',
  binance: 'binance-smart-chain',
  optimism: 'optimistic-ethereum',
  polygon: 'polygon-pos',
};

const symbolMap = {
  ETH: 'ethereum',
};

export class CoinGeckoMetadata {
  private url = 'https://api.coingecko.com/api/v3';
  private proUrl = 'https://pro-api.coingecko.com/api/v3';

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
      let path = `coins/${networkMap[network]}/contract/${contract}`;
      const isSymbol = network.substr(0, 2).toLowerCase() !== '0x';
      if (isSymbol) {
        const id = symbolMap[contract.toUpperCase()];
        if (!id) return Promise.reject(new Error('unsupported symbol'));
        path = `coins/${symbolMap[contract.toUpperCase()]}`;
      }
      const resp = await this.get(path, {});
      const data: CoinGecko.Asset = resp.data;
      return Promise.resolve({
        name: data.name,
        chainId: getChainID(network),
        network,
        address: contract,
        type: 'ERC20',
        decimals: data.detail_platforms[!isSymbol ? networkMap[network] : ''].decimal_place,
        logoURI: data.image.large,
        price: data.market_data.current_price.usd,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

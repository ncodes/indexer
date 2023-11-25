// tslint:disable-next-line:max-classes-per-file
import axios from 'axios';
import { CoinGeckoConfig, getChainID } from '../../network/common';
import { MetadataSource } from './metadata.service';

export class CoinGeckoMetadata implements MetadataSource {
  private url = 'https://api.coingecko.com/api/v3';
  private proUrl = 'https://pro-api.coingecko.com/api/v3';

  private async get(path: string, params: any = {}) {
    try {
      const url = process.env.COINGECKO_KEY ? this.proUrl : this.url;
      const resp = axios.get(`${url}/${path}`, {
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
   * @param symbolOrContract The asset contract address or symbol
   * @returns
   */
  async getTokenInfo(network: string, symbolOrContract: string): Promise<TokenMetadata> {
    let path = `coins/${CoinGeckoConfig.networkToID[network]}/contract/${symbolOrContract}`;

    const isSymbol = !symbolOrContract.match(/^0x/i);
    if (isSymbol) {
      const id = CoinGeckoConfig.symbolToID[symbolOrContract.toUpperCase()];
      if (!id) throw new Error('unsupported symbol');
      path = `coins/${id}`;
    }

    const resp = await this.get(path, {});
    const data: CoinGecko.Asset = resp.data;
    return {
      name: data.name,
      chainId: getChainID(network),
      network,
      type: 'ERC20',
      address: !isSymbol ? symbolOrContract : null,
      symbol: data.symbol.toUpperCase(),
      decimals: data.detail_platforms[data.asset_platform_id || ''].decimal_place || 0,
      logoURI: data.image.large,
      price: data.market_data.current_price.usd,
      isContract: !isSymbol,
    };
  }
}

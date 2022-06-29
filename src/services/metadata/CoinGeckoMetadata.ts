// tslint:disable-next-line:max-classes-per-file
import * as CoinGecko from 'coingecko-api';
import { getChainID } from '../../network/common';

export class CoinGeckoMetadata {
  /**
   * Get logo url of contract
   * @param network The asset network
   * @param contract The asset contract
   * @returns
   */
  async getTokenInfo(network: string, contract: string): Promise<TokenInfo> {
    const client = new CoinGecko();
    const networkMap = {
      ethereum: 'ethereum',
      binance: 'binance-smart-chain',
      optimism: 'optimistic-ethereum',
      polygon: 'polygon-pos',
    };

    try {
      const resp = await client.coins.fetchCoinContractInfo(contract, networkMap[network]);
      if (!resp.success) return Promise.resolve(null);
      return Promise.resolve({
        name: resp.data.name,
        chainId: getChainID(network),
        network,
        address: contract,
        type: 'ERC20',
        decimals: 0,
        logoURI: resp.data.image.large,
      });
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
  async getTokenLogo(network: string, contract: string): Promise<string> {
    const client = new CoinGecko();

    const networkMap = {
      ethereum: 'ethereum',
      binance: 'binance-smart-chain',
      optimism: 'optimistic-ethereum',
      polygon: 'polygon-pos',
    };

    try {
      const resp = await client.coins.fetchCoinContractInfo(contract, networkMap[network]);
      if (!resp.success) return Promise.resolve(null);
      return Promise.resolve(resp.data.image.large);
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

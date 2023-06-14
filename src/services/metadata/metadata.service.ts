import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NetworkService from '../../network/network.service';
import { isValidNetwork } from '../../network/common';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { isDevMode, isProdMode } from '../../common/common';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';

// tslint:disable-next-line:max-classes-per-file
abstract class MetadataSource {
  abstract getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenMetadata>;
}

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  constructor(private cfg: ConfigService, private netSrv: NetworkService) {
    switch (cfg.get('app.tokenMetadataSource')) {
      case 'coingecko':
        this.source = new CoinGeckoMetadata();
        break;
      case 'coinmarketcap':
        this.source = new CoinMarketCapMetadata(cfg.get('app.cmc.key'));
    }
  }

  /**
   * Get an asset's logo link
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   * @returns
   */
  async getTokenLogo(symbolOrNetwork: string, contract: string): Promise<string> {
    const info = await this.source.getTokenInfo(symbolOrNetwork, contract);
    return Promise.resolve(info.logoURI);
  }

  /**
   * Get token info
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   */
  async getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenMetadata> {
    const info = await this.source.getTokenInfo(symbolOrNetwork, contract);
    if (!info) return Promise.reject(new Error('token not found'));
    const { network } = info;
    if (network && !isValidNetwork(network)) return Promise.reject('network not supported');
    if (info.isContract && network && isProdMode() && !info.decimals)
      info.decimals = await this.netSrv.getERC20Contract(network, contract).decimals();
    if (isDevMode() && !info.decimals) info.decimals = 18;
    return Promise.resolve(info);
  }
}

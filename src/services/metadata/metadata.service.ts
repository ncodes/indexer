import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import NetworkService from '../../network/network.service';
import { isValidNetwork } from '../../network/common';

// tslint:disable-next-line:max-classes-per-file
abstract class MetadataSource {
  abstract getTokenLogo(symbolOrNetwork: string, contract: string): Promise<string>;

  abstract getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenInfo>;
}

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  constructor(private cfg: ConfigService, private netSrv: NetworkService) {
    // this.source = new NomicsMetadata(cfg.get('app.nomics.key'));
    // this.source = new CoinMarketCapMetadata(cfg.get('app.cmc.key'));
    this.source = new CoinGeckoMetadata();
  }

  /**
   * Get an asset's logo link
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   * @returns
   */
  async getTokenLogo(symbolOrNetwork: string, contract: string): Promise<string> {
    return this.source.getTokenLogo(symbolOrNetwork, contract);
  }

  /**
   * Get token info
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   */
  async getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenInfo> {
    const info = await this.source.getTokenInfo(symbolOrNetwork, contract);
    if (!info) return Promise.reject(new Error('token not found'));
    const { network } = info;
    if (!isValidNetwork(network)) return Promise.reject('network not' + ' supported');
    info.decimals = await this.netSrv.getTokenDecimals(this.netSrv.getProvider(network), contract);
    return Promise.resolve(info);
  }
}

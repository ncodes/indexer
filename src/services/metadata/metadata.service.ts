import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NetworkService from '../../network/network.service';
import { isValidNetwork } from '../../network/common';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { isDevMode, isProdMode } from '../../common/common';

// tslint:disable-next-line:max-classes-per-file
abstract class MetadataSource {
  abstract getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenInfo>;
}

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  constructor(private cfg: ConfigService, private netSrv: NetworkService) {
    this.source = new CoinMarketCapMetadata(cfg.get('app.cmc.key'));
    // this.source = new CoinGeckoMetadata();
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
  async getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenInfo> {
    const info = await this.source.getTokenInfo(symbolOrNetwork, contract);
    if (!info) return Promise.reject(new Error('token not found'));
    const { network } = info;
    if (!isValidNetwork(network)) return Promise.reject('network not' + ' supported');
    if (isProdMode() && !info.decimals)
      info.decimals = await this.netSrv.getTokenDecimals(
        this.netSrv.getProvider(network),
        contract,
      );
    if (isDevMode() && !info.decimals) info.decimals = 18;
    return Promise.resolve(info);
  }
}

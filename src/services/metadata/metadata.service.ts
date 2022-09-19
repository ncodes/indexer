import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import NetworkService from '../../network/network.service';
import { isValidNetwork } from '../../network/common';

// tslint:disable-next-line:max-classes-per-file
abstract class MetadataSource {
  abstract getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenInfo>;
}

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  constructor(private cfg: ConfigService, private netSrv: NetworkService) {
    this.source = new CoinGeckoMetadata();
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
    if (!info.decimals)
      info.decimals = await this.netSrv.getTokenDecimals(
        this.netSrv.getProvider(network),
        contract,
      );
    return Promise.resolve(info);
  }
}

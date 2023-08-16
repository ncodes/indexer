import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NetworkService from '../../network/network.service';
import { isValidNetwork, isZero, pow10D } from '../../network/common';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';
import { isDevMode, isProdMode, toDec } from '../../common/common';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import { findInLocal, findInSynthetic } from '../../common/token_list';
import { RedisService } from '../redis.service';

// tslint:disable-next-line:max-classes-per-file
export abstract class MetadataSource {
  abstract getTokenInfo(network: string, symbolOrContract: string): Promise<TokenMetadata>;
}

@Injectable()
export class MetadataService {
  private source: MetadataSource;

  /**
   * Initialize the service
   * @param cfg The config service
   * @param netSrv The network service
   * @param redisSrv The redis service
   */
  constructor(
    private cfg: ConfigService,
    @Inject(forwardRef(() => NetworkService))
    private netSrv: NetworkService,
    private redisSrv: RedisService,
  ) {
    const metaSource = this.cfg.get('app.tokenMetadataSource');
    if (metaSource === 'coingecko') {
      this.source = new CoinGeckoMetadata();
    } else if (metaSource === 'coinmarketcap') {
      this.source = new CoinMarketCapMetadata(cfg.get('app.cmc.key'));
    }
  }

  /**
   * Get an asset's logo URL.
   * It first checks the local index, then the synthetic index, then the external source.
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   * @returns
   */
  async getTokenLogo(symbolOrNetwork: string, contract: string): Promise<string> {
    let info = findInLocal(contract);

    if (!info) info = findInSynthetic(contract);

    if (!info) {
      const cached = await this.redisSrv.get(`token_logo_${symbolOrNetwork}_${contract}`);
      if (cached) return Promise.resolve(cached);
    }

    if (!info) info = await this.source.getTokenInfo(symbolOrNetwork, contract);

    if (!info) return Promise.reject(new Error('token not found'));

    await this.redisSrv.setWithExpire(`token_logo_${symbolOrNetwork}_${contract}`, info.logoURI, 60 * 60 * 24 * 7);
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

  /**
   * Convert a token amount to USD
   * @param net The token's host network
   * @param amount The token amount (in the lowest denomination)
   * @param contract The token contract address
   */
  async toUsd(net: string, amount: string, contract: string): Promise<number> {
    if (isZero(amount)) return 0;
    const tokenInfo = await this.getTokenInfo(net, contract);
    return toDec(amount).div(pow10D(tokenInfo.decimals)).mul(tokenInfo.price).toNumber();
  }

  /**
   * Try to convert a token amount to USD or return zero on failure
   * @param net The token's host network
   * @param amount The token amount (in the lowest denomination)
   * @param contract The token contract address
   */
  async tryToUsd(net: string, amount: string, contract: string): Promise<number> {
    try {
      return await this.toUsd(net, amount, contract);
    } catch (e) {
      return 0;
    }
  }
}

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { isDevMode, isProdMode, toDec } from '../../common/common';
import { findInLocalhost, findInSynthetic } from '../../common/token_list';
import { isValidNetwork, isZero, pow10D } from '../../network/common';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../exchange_rate.service';
import { RedisService } from '../redis.service';
import { CoinGeckoMetadata } from './CoinGeckoMetadata';
import { CoinMarketCapMetadata } from './CoinMarketCapMetadata';

// tslint:disable-next-line:max-classes-per-file
export abstract class MetadataSource {
  abstract getTokenInfo(network: string, symbolOrContract: string): Promise<TokenMetadata>;
}

interface Options {
  // Indicates the amount is already in the highest denomination
  isHD: boolean;
  // Indicates whether to refetch the token info
  refetch: boolean;
}

@Injectable()
export class MetadataService {
  private logger = new Logger(MetadataService.name);
  private source: MetadataSource;

  /**
   * Initialize the service
   * @param cfg The config service
   * @param netSrv The network service
   * @param redisSrv The redis service
   * @param exRateSrv
   */
  constructor(
    private cfg: ConfigService,
    @Inject(forwardRef(() => NetworkService))
    private netSrv: NetworkService,
    private redisSrv: RedisService,
    private exRateSrv: ExchangeRateService,
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
    // Check if address exist in local/synthetic list.
    let info = findInLocalhost(contract);
    if (!info) info = findInSynthetic(contract);

    // If not found, check redis cache
    if (!info) {
      const cached = await this.redisSrv.get(`token_logo_${symbolOrNetwork}_${contract}`);
      if (cached) return Promise.resolve(cached);
    }

    // If not found, fetch from external source
    if (!info) info = await this.source.getTokenInfo(symbolOrNetwork, contract);
    if (!info) return Promise.reject(new Error('token not found'));

    // Cache the logo URL for 7 days
    await this.redisSrv.setWithExpire(`token_logo_${symbolOrNetwork}_${contract}`, info.logoURI, 60 * 60 * 24 * 7);

    return Promise.resolve(info.logoURI);
  }

  /**
   * Get token information.
   * - It first checks the local index, then the synthetic index, then the external source.
   * - If it finds the local index, it will return the information provided by the index.
   * - If it finds the synthetic index, it will return the information provided by the index after
   *   querying the exchange rate service for the synthetic token price.
   * - If it finds the redis short-term cache, it will return the information provided by the cache.
   * - If it did not find the redis cache, it will check if the address has been flagged as a 'bad' and return 'not found' if so.
   * - If it finds the external source, it will return the information provided by the source.
   * - If it failed to find from source, it will temporarily cache the address as a 'bad' address so
   *   subsequent requests will not immediately attempt to fetch again and throw an error.
   * @param symbolOrNetwork The asset symbol or network name
   * @param contract The contract address
   */
  async getTokenInfo(symbolOrNetwork: string, contract: string): Promise<TokenMetadata> {
    const local = findInLocalhost(contract) || findInSynthetic(contract);
    if (local) {
      return {
        network: symbolOrNetwork,
        price: !local.isSynthetic ? local.price : (await this.exRateSrv.tryGet(local.symbol))?.toNumber() || 0,
        decimals: local.decimals,
        logoURI: local.logoURI,
        isContract: false,
        name: local.name,
      };
    }

    // Check redis cache for existing token information
    const cached = await this.redisSrv.get(`token_info_${contract}`);
    if (cached) return Promise.resolve(JSON.parse(cached));

    // Check redis cache for bad address match
    const badAddress = await this.redisSrv.get(`bad_address_${contract}`);
    if (badAddress) return Promise.reject(new Error('token not found'));

    // If not found, fetch from external source
    let info: TokenMetadata;
    try {
      info = await this.source.getTokenInfo(symbolOrNetwork, contract);
      if (!info) return Promise.reject(new Error('token not found'));
    } catch (e) {
      // Cache the address as a 'bad' address so subsequent requests will not immediately attempt to fetch again.
      // It could be the address has been de-listed from the source or it never existed.
      // TODO: Permanently blacklist the address after a certain number of failures over a duration of time.
      await this.redisSrv.setWithExpire(`bad_address_${contract}`, JSON.stringify({}), 60);
      throw e;
    }

    // Ensure the network is valid
    const { network } = info;
    if (network && !isValidNetwork(network)) return Promise.reject('network not supported');

    // If the token is a contract, try to get the decimals if not provided
    if (info.isContract && network && isProdMode() && !info.decimals)
      info.decimals = await this.netSrv.getERC20Contract(contract).decimals();

    // In dev mode, set decimals to 18 if not provided
    if (isDevMode() && !info.decimals) info.decimals = 18;

    // Cache the token info for n seconds
    await this.redisSrv.setWithExpire(`token_info_${contract}`, JSON.stringify(info), 30);

    return info;
  }

  /**
   * Convert a token amount to USD
   * @param net The token's host network
   * @param amount The token amount (in the lowest denomination)
   * @param contract The token contract address
   * @param tokenInfo Optional token metadata. If not provided, it will be fetched from the source
   */
  async toUsd(
    net: string,
    amount: string,
    contract: string,
    tokenInfo?: Partial<TokenMetadata & Options>,
  ): Promise<number> {
    if (isZero(amount)) return 0;
    const isHD = tokenInfo?.isHD;
    if (!tokenInfo || tokenInfo.refetch) tokenInfo = await this.getTokenInfo(net, contract);
    if (!isHD) return toDec(amount).div(pow10D(tokenInfo.decimals)).mul(tokenInfo.price).toNumber();
    else return toDec(amount).mul(tokenInfo.price).toNumber();
  }

  /**
   * Try to convert a token amount to USD or return zero on failure
   * @param net The token's host network
   * @param amount The token amount (in the lowest denomination)
   * @param contract The token contract address
   * @param tokenInfo Optional token metadata. If not provided, it will be fetched from the source
   */
  async tryToUsd(
    net: string,
    amount: string,
    contract: string,
    tokenInfo?: Partial<TokenMetadata & Options>,
  ): Promise<number> {
    try {
      return await this.toUsd(net, amount, contract, tokenInfo);
    } catch (e) {
      this.logger.error(axios.isAxiosError(e) ? e.response?.data : e, e.stack, MetadataService.name);
      return 0;
    }
  }
}

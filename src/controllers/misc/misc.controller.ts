import { Controller, Get, Param } from '@nestjs/common';
import { findInLocalhost, getTokenInfo, TokenList } from '../../common/token_list';
import { ok, throw400 } from '../../common/responses/responses';
import { MetadataService } from '../../services/metadata/metadata.service';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { ConfigService } from '@nestjs/config';
import { getCodeList, getName } from 'country-list';
import Meta, { FeeName } from '../../models/meta';
import { isValidNetwork } from '../../network/common';

@Controller('v1/misc')
export class MiscController {
  constructor(
    private cfgSrv: ConfigService,
    private metadataSrv: MetadataService,
    private netSrv: NetworkService,
    private exRateSvr: ExchangeRateService,
  ) {}

  /**
   * Get token list
   * @param network The network name
   */
  @Get('token-list/:network')
  async getTokenList(@Param('network') network: string) {
    return ok().data(TokenList[network]).build();
  }

  /**
   * Get token information. If unable to find token info in local index,
   * it will be sourced from an external source provided by MetadataService.
   * @param network The network name
   * @param address The contract name
   */
  @Get('token-info/:network/:address')
  async getTokenInfo(@Param('network') network: string, @Param('address') address: string) {
    let info: TokenInfo;
    network = network !== '-' ? network : undefined;
    if (network && !isValidNetwork(network)) throw400('network not supported');

    // check if address exist in localhost network.
    // If yes, return it with a mock USD price of $1
    // Useful for testing
    const assetInfo = findInLocalhost(address);
    if (assetInfo) info = { network, price: 1, ...assetInfo };

    if (!info && network) info = getTokenInfo(network, address);
    if (!info) info = await this.metadataSrv.getTokenInfo(network, address);
    return ok().data(info).build();
  }

  /**
   * Get fiat currency rate to 1 USD
   * @param symbol The currency symbol (e.g USD, NGN)
   */
  @Get('fiat-rate/:symbol')
  async getFiatRate(@Param('symbol') symbol: string) {
    const rate = await this.exRateSvr.get(symbol);
    if (!rate) throw400('symbol not supported');
    return ok().data({ rate }).build();
  }

  /**
   * Get crypto asset rate to 1 USD
   * @param network The network name
   * @param token The token address
   */
  @Get('crypto-rate/:network/:token')
  async getCryptoRate(@Param('network') network: string, @Param('token') token: string) {
    const info = await this.metadataSrv.getTokenInfo(network, token);
    return ok().data({ price: info.price }).build();
  }

  /**
   * Get all contract addresses
   */
  @Get('contracts-address')
  async getContractAddresses() {
    return ok().data(this.cfgSrv.get('app.networks')).build();
  }

  /**
   * Get all contract addresses
   */
  @Get('contracts-params')
  async getContractsParams() {
    return ok().data(this.cfgSrv.get('app.contractsParams')).build();
  }

  /**
   * Get all shareable tokens
   * @param network - The network name
   */
  @Get('/:network/shareable-tokens')
  async getShareableTokens(@Param('network') network: string) {
    const addresses = await Meta.getShareableAssets(network);
    return ok()
      .data(addresses.map((addr) => addr.toLowerCase()))
      .build();
  }

  /**
   * Get all stable tokens
   * @param network - The network name
   */
  @Get('/:network/stable-tokens')
  async getStableTokens(@Param('network') network: string) {
    const addresses = await Meta.getStableAssets(network);
    return ok()
      .data(addresses.map((addr) => addr.toLowerCase()))
      .build();
  }

  /**
   * Get all stable tokens
   * @param network - The network name
   */
  @Get('/:network/protocol-fees')
  async getProtocolFees(@Param('network') network: string) {
    const res: { [key in FeeName]: number } = {
      [FeeName.InstantSwapFee]: 0,
      [FeeName.SynthSwapFee]: 0,
      [FeeName.StableSwapFee]: 0,
    };

    const p2p = await Meta.getProtocolFee(network, FeeName.SynthSwapFee);
    if (p2p) res[FeeName.SynthSwapFee] = parseFloat(p2p.value);

    const instant = await Meta.getProtocolFee(network, FeeName.InstantSwapFee);
    if (instant) res[FeeName.InstantSwapFee] = parseFloat(instant.value);

    const stable = await Meta.getProtocolFee(network, FeeName.StableSwapFee);
    if (stable) res[FeeName.StableSwapFee] = parseFloat(stable.value);

    return ok().data(res).build();
  }

  /**
   * Get supported countries
   */
  @Get('/supported-countries')
  getSupportedCountries() {
    return ok()
      .data(Object.keys(getCodeList()).map((code) => getName(code)))
      .build();
  }
}

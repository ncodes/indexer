import { Controller, Get, Param } from '@nestjs/common';
import { findInLocalhost, getTokenInfo, TokenLists } from '../../common/token_list';
import { ok, throw400 } from '../../common/responses/responses';
import { MetadataService } from '../../services/metadata/metadata.service';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import Meta, { FeeName } from '../../models/meta';
import { isValidNetwork } from '../../network/common';
import AssetRegistry from '../../models/asset_registry';
import { ConfigService } from '../../config/config.service';

@Controller('v1/misc')
export class MiscController {
  constructor(
    private cfgSrv: ConfigService,
    private metadataSrv: MetadataService,
    private exRateSvr: ExchangeRateService,
  ) {}

  /**
   * Get token list
   * @param network The network name
   */
  @Get('token-list/:network')
  async getTokenList(@Param('network') network: string) {
    return ok().data(TokenLists[network]).build();
  }

  /**
   * Get token information. If unable to find token info in local index,
   * it will be sourced from an external source provided by MetadataService.
   * @param network The network name
   * @param address The contract name
   */
  @Get('token-info/:network/:address')
  async getTokenInfo(@Param('network') network: string, @Param('address') address: string) {
    let info: TokenList.Token;
    network = network !== '-' ? network : undefined;
    if (network && !isValidNetwork(network)) throw400('network not supported');

    // check if address exist in localhost network.
    // If yes, return it with a mock USD price of $1
    // Useful for testing
    info = findInLocalhost(address);

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
    const addresses = await AssetRegistry.getSharedAssets(network);
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
    const addresses = await AssetRegistry.getStableAssets(network);
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
    const data = {
      [FeeName.InstantSwapFeeBp]: await Meta.getProtocolFee(network, FeeName.InstantSwapFeeBp),
      [FeeName.SynthSwapFeeBp]: await Meta.getProtocolFee(network, FeeName.SynthSwapFeeBp),
      [FeeName.StableSwapFeeBp]: await Meta.getProtocolFee(network, FeeName.StableSwapFeeBp),
      [FeeName.FixedSynthSwapFee]: await Meta.getProtocolFee(network, FeeName.FixedSynthSwapFee),
      [FeeName.FixedNFTSwapFee]: await Meta.getProtocolFee(network, FeeName.FixedNFTSwapFee),
      [FeeName.InstantNFTSwapFeeBp]: await Meta.getProtocolFee(network, FeeName.InstantNFTSwapFeeBp),
    };
    return ok().data(data).build();
  }
}

import {
  ChainNames,
  TokenLists,
  contractsParams,
  getChainByName,
  getTokenInfo,
  isValidChain,
} from '@jointlabs/chains-info';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Client } from '@xmtp/xmtp-js';
import { Wallet } from 'ethers';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import { ConfigService } from '../../config/config.service';
import AssetRegistry from '../../models/asset_registry';
import Meta, { FeeName } from '../../models/meta';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { ErrTokenNotFound, MetadataService } from '../../services/metadata/metadata.service';

@Controller('v1/misc')
export class MiscController {
  constructor(
    private cfgSrv: ConfigService,
    private metadataSrv: MetadataService,
    private exRateSvr: ExchangeRateService,
  ) {}

  @Get('health')
  async getHealth() {
    return ok().build();
  }

  /**
   * Get token list
   * @param network The network name
   */
  @Get('token-list/:network')
  async getTokenList(@Param('network') network: string) {
    const list: TokenList.TokenData = TokenLists[network];
    list.tokens = list.tokens.filter((token) => {
      if (!token.disabled) return token;
    });
    return ok().data(list).build();
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
    if (network && !isValidChain(network)) throw400('network not supported');
    if (network) info = getTokenInfo(network as ChainNames, address);
    if (!info) info = await this.metadataSrv.getTokenInfo(network, address);
    return ok().data(info).build();
  }

  /**
   * Get synthetic asset USD rate (ex: 1 NGN = 0.0013 USD)
   * @param symbol The currency symbol (e.g. USD, NGN, GIFT CARD)
   * @param reverse Return the reverse rate (e.g. 1 USD = 700 NGN)
   */
  @Get('synth-rate/:symbol')
  async getSynthRate(@Param('symbol') symbol: string, @Query('reverse') reverse: boolean) {
    const rate = await this.exRateSvr.get(symbol);
    if (!rate) throw400('symbol not supported');
    return ok()
      .data({ price: !reverse ? 1 / rate.toNumber() : rate.toNumber() })
      .build();
  }

  /**
   * Get crypto asset rate to 1 USD
   * @param network The network name
   * @param token The token address
   */
  @Get('crypto-rate/:network/:token')
  async getCryptoRate(@Param('network') network: string, @Param('token') token: string) {
    try {
      const info = await this.metadataSrv.getTokenInfo(network, token);
      return ok().data({ price: info.price }).build();
    } catch (error) {
      let msg = error.message;
      if (error.response && error.response.status == 400) {
        msg = ErrTokenNotFound;
      }
      throw404(msg);
    }
  }

  /**
   * Get all contract addresses
   */
  @Get(':net/contracts-address')
  async getContractAddresses(@Param('net') net: string) {
    const chainInfo = getChainByName(net);

    const contractsAddress = {};
    for (const contract of Object.keys(chainInfo.contracts)) {
      contractsAddress[contract] = chainInfo.contracts[contract].address;
    }

    return ok().data(contractsAddress).build();
  }

  /**
   * Get all contract addresses
   */
  @Get('contracts-params')
  async getContractsParams() {
    return ok().data(contractsParams).build();
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

  /**
   * Get points for energon
   * @returns
   */
  @Get('points-per-energon')
  async getPointsPerEnergon() {
    return ok()
      .data({
        value: parseFloat(this.cfgSrv.get('app.pointsPerEnergon')),
      })
      .build();
  }

  /**
   * Determines if a given address has enabled xmtp chat
   * @param address The address to check
   * @returns
   */
  @Get('chat-enabled/:address')
  async enabledForChat(@Param('address') address: string) {
    const wallet = Wallet.createRandom();
    const xmtp = await Client.create(wallet, { env: this.cfgSrv.get('app.xmtpEnv') });
    return ok()
      .data({ enabled: await xmtp.canMessage(address) })
      .build();
  }
}

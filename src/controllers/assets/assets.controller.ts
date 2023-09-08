import { Controller, Get, Logger, Param } from '@nestjs/common';
import { FeaturedAssets } from '../../common/featured_assets';
import Swap from '../../models/swap';
import { toDec } from '../../common/common';
import { ErrServerError, ok, throw400, throw404 } from '../../common/responses/responses';
import MarketPrice from '../../models/market_price';
import Liquidity from '../../models/liquidity';
import { findInLocalhost, getTokenInfo, ListName, TokenLists } from '../../common/token_list';
import { MetadataService } from '../../services/metadata/metadata.service';
import AssetRegistry from '../../models/asset_registry';
import { isValidNetwork } from '../../network/common';
import * as _ from 'lodash';

@Controller('v1/assets')
export class AssetsController {
  private logger = new Logger(AssetsController.name);

  constructor(private metadataSrv: MetadataService) {}

  /**
   * Get featured assets stats
   */
  @Get('featured')
  async getFeaturedAssetsStats() {
    const res: AssetStat[] = [];

    for (const fa of FeaturedAssets) {
      const data: AssetStat = {
        symbol: fa.symbol,
        volume24h: '0',
        price24h: 0,
        lowestPrice24h: '0',
        highestPrice24h: '0',
      };

      for (const c of fa.contracts) {
        const [volume, price, lowestPrice, highestPrice] = await Promise.all([
          Swap.getVolume(c.net, undefined, c.addr, undefined, undefined, undefined, 1440),
          c.primary ? MarketPrice.priceChangeByBaseAddress(c.net, c.addr, 24) : Promise.resolve(data.price24h),
          c.primary ? Liquidity.getLowestPrice(c.net, undefined, c.addr, 24) : Promise.resolve(data.lowestPrice24h),
          c.primary ? Liquidity.getHighestPrice(c.net, undefined, c.addr, 24) : Promise.resolve(data.highestPrice24h),
        ]);

        data.volume24h = toDec(volume).add(data.volume24h).toString();
        data.price24h = price;
        data.lowestPrice24h = lowestPrice;
        data.highestPrice24h = highestPrice;
      }

      res.push(data);
    }

    return ok().data(res).build();
  }

  // Get swappable token list
  @Get('/:net')
  async getTokenList(@Param('net') net: string) {
    if (!isValidNetwork(net)) throw400('network is unknown');
    const tokens = TokenLists[net as ListName].tokens;
    const synth = TokenLists['synthetic']?.tokens;
    return ok().data(tokens.concat(synth)).build();
  }

  /**
   * Get a single asset's statistics
   * @param net The network name
   * @param address The asset address
   */
  @Get(':net/:address')
  async getAssetStats(@Param('net') net: string, @Param('address') address: string) {
    let info = findInLocalhost(address);
    if (!info && net) info = getTokenInfo(net, address);
    if (!info)
      info = await this.metadataSrv.getTokenInfo(net, address).catch((e) => {
        this.logger.error('failed to get token info', e);
        throw ErrServerError;
      });
    if (!info) throw404('token not found');

    const data: AssetStat = {
      address,
      symbol: info.symbol,
      volume24h: '0',
      price24h: 0,
      network: net,
    };

    const volume = await Swap.getVolume(net, undefined, address, undefined, undefined, undefined, 1440);
    data.volume24h = toDec(volume).add(data.volume24h).toString();
    data.price24h = await MarketPrice.priceChangeByBaseAddress(undefined, address, 24);
    data.lowestPrice24h = await Liquidity.getLowestPrice(undefined, undefined, address, 24);
    data.highestPrice24h = await Liquidity.getHighestPrice(undefined, undefined, address, 24);

    return ok().data(data).build();
  }

  /**
   * Get a single asset's registry info
   * @param net The network name
   * @param address The asset address
   */
  @Get('registry/:net/:address')
  async getRegistryInfo(@Param('net') net: string, @Param('address') address: string) {
    const info = await AssetRegistry.getByNetworkAndAddress(net, address);
    if (!info) throw404('registry info not found');
    return ok().data(info).build();
  }
}

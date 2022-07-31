import { Controller, Get, Param } from '@nestjs/common';
import { FeaturedAssets } from '../../common/featured_assets';
import Swap from '../../models/swap';
import { ToDec } from '../../common/common';
import { ok, throw404 } from '../../common/responses/responses';
import MarketPrice from '../../models/market_price';
import Liquidity from '../../models/liquidity';

@Controller('v1/assets')
export class AssetsController {
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
      };
      res.push(data);

      // Get and add all volumes from all supported network deployments
      for (const c of fa.contracts) {
        const volume = await Swap.getVolume(undefined, undefined, c.addr, undefined, 1440);
        data.volume24h = ToDec(volume).add(data.volume24h).toString();
      }

      // Get other data from the first deployment (typically, the most
      // popular deployment).
      data.price24h = await MarketPrice.priceChangeByBaseAddress(
        undefined,
        fa.contracts[0].addr,
        24,
      );
      data.lowestPrice24h = await Liquidity.getLowestPrice(
        undefined,
        undefined,
        fa.contracts[0].addr,
        24,
      );
      data.highestPrice24h = await Liquidity.getHighestPrice(
        undefined,
        undefined,
        fa.contracts[0].addr,
        24,
      );
    }

    return ok().data(res).build();
  }

  /**
   * Get a single asset's statistics
   * @param address The token address
   */
  @Get(':address')
  async getAssetStats(@Param('address') address: string) {
    // Find a liquidity with matching base address
    const liq = await Liquidity.getByBaseAddress(address);
    if (!liq) throw404('unknown asset', undefined, 'address');

    const data: AssetStat = {
      address,
      symbol: liq.base,
      volume24h: '0',
      price24h: 0,
      network: liq.network,
    };

    const volume = await Swap.getVolume(undefined, undefined, address, undefined, 1440);
    data.volume24h = ToDec(volume).add(data.volume24h).toString();
    data.price24h = await MarketPrice.priceChangeByBaseAddress(undefined, address, 24);
    data.lowestPrice24h = await Liquidity.getLowestPrice(undefined, undefined, address, 24);
    data.highestPrice24h = await Liquidity.getHighestPrice(undefined, undefined, address, 24);

    return ok().data(data).build();
  }
}

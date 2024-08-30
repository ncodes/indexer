import { Injectable } from '@nestjs/common';
import Market from '../models/market';
import AssetRegistry from '../models/asset_registry';
import Meta, { FeeName } from '../models/meta';
import { toDec } from '../common/common';
import { pow10 } from '../network/common';

@Injectable()
export class FeeCalculatorService {
  /**
   * Calculates the fee for a given order
   * @param options
   * @param options.network The network name
   * @param options.marketAddress The market address
   * @param options.orderAmount The order amount
   * @param options.orderPrice The order price
   */
  async calculateFee({
    network,
    marketAddress,
    orderAmount,
    orderPrice,
  }: {
    network: string;
    marketAddress: string;
    orderAmount?: string;
    orderPrice?: string;
  }) {
    const market = await Market.getMarket(network, marketAddress);
    if (!market) return Promise.reject(new Error('market not found'));

    orderAmount = orderAmount || '0';
    orderPrice = orderPrice || '0';

    const feeInfo = {
      cost: '0',
      feeBp: 0,
      amtToCharge: '0',
      mktCreatorFee: '0',
      protoFee: '0',
      totalFees: '0',
      remaining: '0',
      protoFeeRate: '0',
      mktCreatorFeeRate: '0',
      mktFeeBp: 0,
    };

    const { base, baseType, quoteType, baseDecimals } = market;
    const { instantSwapFeeBp, stableSwapFeeBp, syntheticSwapFeeBp, instantNFTSwapFeeBp } = await this.getFeeInfo(
      network,
    );
    const denom = 10000;

    // ERC20/ERC20, ERC20/NATIVE, NATIVE/ERC20, NATIVE/NATIVE fee calculation.
    if (
      (Market.isERC20(baseType) && Market.isERC20(quoteType)) ||
      (Market.isERC20(baseType) && Market.isNative(quoteType)) ||
      (Market.isNative(baseType) && Market.isERC20(quoteType)) ||
      (Market.isNative(baseType) && Market.isNative(quoteType))
    ) {
      const { feeBp } = await this.getAssetFeeInfo(network, base, instantSwapFeeBp);
      const isMarketStable = await this.isMarketStable(network, market);
      feeInfo.feeBp = isMarketStable ? stableSwapFeeBp : feeBp;
      feeInfo.mktFeeBp = market.commission;

      feeInfo.mktCreatorFee = toDec(orderAmount).mul(feeInfo.mktFeeBp).div(denom).toFixed();
      feeInfo.protoFee = toDec(orderAmount).mul(feeInfo.feeBp).div(denom).toFixed();
      feeInfo.totalFees = toDec(feeInfo.mktCreatorFee).add(feeInfo.protoFee).toFixed();

      return {
        protoFee: feeInfo.protoFee,
        mktCreatorFee: feeInfo.mktCreatorFee,
        feeBp: feeInfo.feeBp,
        mktFeeBp: feeInfo.mktFeeBp,
      };
    }

    // ERC20/SYNTH, SYNTH/ERC20, NATIVE/SYNTH, SYNTH/NATIVE fee calculation.
    if (market.isFungible() && market.involvesERC20OrNative()) {
      const asset = Market.isOnchain(baseType) ? market.baseAddress : market.quoteAddress;

      const decimals = Market.isSynth(quoteType) || Market.isNative(quoteType) ? 18 : baseDecimals;
      feeInfo.cost = toDec(orderAmount).mul(orderPrice).div(pow10(decimals)).toFixed();
      feeInfo.mktFeeBp = market.commission;
      const { feeBp } = await this.getAssetFeeInfo(network, asset, syntheticSwapFeeBp);
      feeInfo.feeBp = feeBp;

      feeInfo.amtToCharge = Market.isSynth(baseType) ? feeInfo.cost : orderAmount;

      feeInfo.mktCreatorFee = toDec(feeInfo.amtToCharge).mul(feeInfo.mktFeeBp).div(denom).toFixed();
      feeInfo.protoFee = toDec(feeInfo.amtToCharge).mul(feeInfo.feeBp).div(denom).toFixed();
      feeInfo.totalFees = toDec(feeInfo.mktCreatorFee).add(feeInfo.protoFee).toFixed();

      return {
        protoFee: feeInfo.protoFee,
        mktCreatorFee: feeInfo.mktCreatorFee,
        feeBp: feeInfo.feeBp,
        mktFeeBp: feeInfo.mktFeeBp,
      };
    }

    // ERC20/NFT, NATIVE/NFT fee calculation.
    if ((Market.isERC20(baseType) || Market.isNative(baseType)) && Market.isNFT(quoteType)) {
      const { feeBp } = await this.getAssetFeeInfo(network, base, instantNFTSwapFeeBp);
      feeInfo.feeBp = feeBp;
      feeInfo.mktFeeBp = market.commission;

      feeInfo.mktCreatorFee = toDec(orderAmount).mul(feeInfo.mktFeeBp).div(denom).toFixed();
      feeInfo.protoFee = toDec(orderAmount).mul(feeInfo.feeBp).div(denom).toFixed();
      feeInfo.totalFees = toDec(feeInfo.mktCreatorFee).add(feeInfo.protoFee).toFixed();

      return {
        protoFee: feeInfo.protoFee,
        mktCreatorFee: feeInfo.mktCreatorFee,
        feeBp: feeInfo.feeBp,
        mktFeeBp: feeInfo.mktFeeBp,
      };
    }

    // SYNTH/SYNTH & SYNTH/NFT fee calculation
    if (Market.isSynth(baseType) && (Market.isSynth(quoteType) || Market.isNFT(quoteType))) {
      // not implemented
    }

    // NFT/ERC20, NFT/NATIVE fee calculation
    if (Market.isNFT(baseType) && (Market.isERC20(quoteType) || Market.isNative(quoteType))) {
      const { feeBp } = await this.getAssetFeeInfo(network, base, instantNFTSwapFeeBp);
      feeInfo.feeBp = feeBp;
      feeInfo.mktFeeBp = market.commission;

      feeInfo.mktCreatorFee = toDec(orderPrice).mul(feeInfo.mktFeeBp).div(denom).toFixed();
      feeInfo.protoFee = toDec(orderPrice).mul(feeInfo.feeBp).div(denom).toFixed();
      feeInfo.totalFees = toDec(feeInfo.mktCreatorFee).add(feeInfo.protoFee).toFixed();

      return {
        protoFee: feeInfo.protoFee,
        mktCreatorFee: feeInfo.mktCreatorFee,
        feeBp: feeInfo.feeBp,
        mktFeeBp: feeInfo.mktFeeBp,
      };
    }

    // NFT/SYNTH fee calculation
    if (Market.isNFT(baseType) && Market.isSynth(quoteType)) {
      // not implemented
    }

    // NFT/NFT fee calculation
    if (Market.isNFT(baseType) && Market.isNFT(quoteType)) {
      // not implemented
    }

    throw new Error('fee calculation for market not implemented');
  }

  async getAssetFeeInfo(network: string, base: string, defaultFeeBp: string | number) {
    let info = await AssetRegistry.getByNetworkAndAddress(network, base);
    if (!info) {
      info = new AssetRegistry({ feeBp: parseInt(defaultFeeBp.toString()), feeFixed: '0', curRate: '0' });
    } else if (info.feeBp == undefined) {
      info.feeBp = parseInt(defaultFeeBp.toString());
    }
    return info;
  }

  async isMarketStable(network: string, market: Market) {
    const base = await AssetRegistry.getByNetworkAndAddress(network, market.baseAddress);
    const quote = await AssetRegistry.getByNetworkAndAddress(network, market.quoteAddress);
    return !!base?.stable && !!quote?.stable;
  }

  async getFeeInfo(network: string) {
    const instantSwapFeeBp = await Meta.get(Meta.makeNetKey(network, FeeName.InstantSwapFeeBp));
    if (instantSwapFeeBp == undefined || instantSwapFeeBp.value == '')
      return Promise.reject(new Error('instantSwapFeeBp param not found'));

    const stableSwapFeeBp = await Meta.get(Meta.makeNetKey(network, FeeName.StableSwapFeeBp));
    if (stableSwapFeeBp == undefined || stableSwapFeeBp.value == '')
      return Promise.reject(new Error('stableSwapFeeBp param not found'));

    const syntheticSwapFeeBp = await Meta.get(Meta.makeNetKey(network, FeeName.SynthSwapFeeBp));
    if (syntheticSwapFeeBp == undefined || syntheticSwapFeeBp.value == '')
      return Promise.reject(new Error('syntheticSwapFeeBp param not found'));

    const instantNFTSwapFeeBp = await Meta.get(Meta.makeNetKey(network, FeeName.InstantNFTSwapFeeBp));
    if (instantNFTSwapFeeBp == undefined || instantNFTSwapFeeBp.value == '')
      return Promise.reject(new Error('instantNFTSwapFeeBp param not found'));

    return {
      instantSwapFeeBp: parseInt(instantSwapFeeBp.value),
      stableSwapFeeBp: parseInt(stableSwapFeeBp.value),
      syntheticSwapFeeBp: parseInt(syntheticSwapFeeBp.value),
      instantNFTSwapFeeBp: parseInt(instantNFTSwapFeeBp.value),
    };
  }
}

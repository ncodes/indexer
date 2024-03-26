import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction } from 'objection';
import { toDec } from '../../common/common';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import Point, { PointAction } from '../../models/point';
import Swap from '../../models/swap';
import User from '../../models/user';
import { ContractCallEvent, pow10 } from '../../network/common';
import { AuthService } from './../auth/auth.service';
import { NFTAllocations } from './data/nft_allocation';
import { MarketPoints } from './data/points';

export const ReferrerPointSharePct = 0.1;
export const MultiplierActivationTokenId = 3252;

export function makeNFTOwnershipPointName(tokenId: number) {
  return `${PointAction.NFTOwnership}:${tokenId}`;
}

export function makeNFTOwnershipRefPointName(tokenId: number) {
  return `${PointAction.NFTOwnership}:${tokenId}:ref`;
}

export function getTokenEnergonAlloc(tokenId: number) {
  return NFTAllocations[tokenId];
}

export function makeCSVPointName(csvHash: string, recipient: string) {
  return `${PointAction.CSV}:${csvHash}:${recipient}`;
}

@Injectable()
export class PointService {
  constructor(private cfg: ConfigService, private authSrv: AuthService) {}

  /**
   * Grant point for a swap
   * @param market The market object
   * @param swapper The swapper address
   * @param amount The swap amount
   * @param txn Optional transaction object
   */
  async grantOnSwap(market: Market, swap: Swap, txn?: Transaction, event?: ContractCallEvent) {
    const pointPerUnit =
      MarketPoints['swap:' + market.address] ?? MarketPoints[market.instant ? 'swap:instant' : 'swap:interactive'];

    // Handle ERC20/ERC20.
    // Award points to both taker and provider
    if (market.instant && market.involvesERC20()) {
      const amountHD = toDec(swap.amount).div(pow10(market.baseDecimals));
      const point = amountHD.mul(pointPerUnit);
      if (point.lte(0)) return false;

      const unitPerLevel = toDec(MarketPoints[`swap:level:${market.address}`] || point);
      const level = Math.max(1, point.div(unitPerLevel).toNumber());

      const takerPoint = await Point.create(
        {
          network: market.network,
          name: `${PointAction.InstantSwap}:${event.transactionHash}:taker:${swap.taker}`,
          address: swap.taker,
          point: point.mul(level).toString(),
          action: PointAction.InstantSwap,
        },
        txn,
      );

      // Give taker's referrer a share of the point
      const taker = await User.getByAddress(swap.taker);
      if (taker && taker.referrer) {
        await Point.create(
          {
            network: market.network,
            name: `${PointAction.InstantSwapRef}:${event.transactionHash}:taker:${swap.taker}:ref`,
            address: taker.referrer,
            referrer: taker.referrer,
            referee: taker.address,
            point: toDec(takerPoint.point).mul(ReferrerPointSharePct).toFixed(),
            action: PointAction.InstantSwapRef,
          },
          txn,
        );
      }

      // await Point.create(
      //   {
      //     network: market.network,
      //     name: `${PointAction.InstantSwap}:${event.transactionHash}:provider:${swap.provider}`,
      //     address: swap.provider,
      //     point: point.mul(level).toString(),
      //     action: PointAction.InstantSwap,
      //   },
      //   txn,
      // );

      // // Give providers's referrer a share of the point
      // const provider = await User.getByAddress(swap.provider);
      // if (provider && provider.referrer) {
      //   await Point.create(
      //     {
      //       network: market.network,
      //       name: `${PointAction.InstantSwapRef}:${event.transactionHash}:provider:${swap.provider}:ref`,
      //       address: provider.referrer,
      //       referrer: provider.referrer,
      //       referee: provider.address,
      //       point: toDec(takerPoint.point).mul(ReferrerPointSharePct).toFixed(),
      //       action: PointAction.InstantSwapRef,
      //     },
      //     txn,
      //   );
      // }

      return true;
    }

    // Handle ERC20/SYNTH or SYNTH/ERC20.
    if (!market.instant && market.involvesERC20()) {
      let amount = toDec(0);

      // If the base token is ERC20, the amount is the swap amount.
      // If the quote token is ERC20, the amount is the swap amount * price (cost in quote token)
      if (Market.isERC20(market.baseType)) {
        amount = toDec(swap.amount).div(pow10(market.baseDecimals));
      } else if (Market.isERC20(market.quoteType)) {
        amount = toDec(swap.amount)
          .mul(swap.price)
          .div(pow10(market.quoteDecimals + market.baseDecimals));
      }

      const point = amount.mul(pointPerUnit);
      if (point.lte(0)) return false;

      const unitPerLevel = toDec(MarketPoints[`swap:level:${market.address}`] || point);
      const level = Math.max(1, point.div(unitPerLevel).toNumber());

      const takerPoint = await Point.create(
        {
          network: market.network,
          name: `${PointAction.InteractiveSwap}:${event.transactionHash}:taker:${swap.taker}`,
          address: swap.taker,
          point: point.mul(level).toString(),
          action: PointAction.InteractiveSwap,
        },
        txn,
      );

      // Give taker's referrer a share of the point
      const taker = await User.getByAddress(swap.taker);
      if (taker && taker.referrer) {
        await Point.create(
          {
            network: market.network,
            name: `${PointAction.InteractiveSwapRef}:${event.transactionHash}:taker:${swap.taker}:ref`,
            address: taker.referrer,
            referrer: taker.referrer,
            referee: taker.address,
            point: toDec(takerPoint.point).mul(ReferrerPointSharePct).toFixed(),
            action: PointAction.InteractiveSwapRef,
          },
          txn,
        );
      }

      // await Point.create(
      //   {
      //     network: market.network,
      //     name: `${PointAction.InteractiveSwap}:${event.transactionHash}:provider:${swap.provider}`,
      //     address: swap.provider,
      //     point: point.mul(level).toString(),
      //     action: PointAction.InteractiveSwap,
      //   },
      //   txn,
      // );

      // // Give provider's referrer a share of the point
      // const provider = await User.getByAddress(swap.provider);
      // if (provider && provider.referrer) {
      //   await Point.create(
      //     {
      //       network: market.network,
      //       name: `${PointAction.InteractiveSwapRef}:${event.transactionHash}:provider:${swap.provider}:ref`,
      //       address: provider.referrer,
      //       referrer: provider.referrer,
      //       referee: provider.address,
      //       point: toDec(takerPoint.point).mul(ReferrerPointSharePct).toFixed(),
      //       action: PointAction.InteractiveSwapRef,
      //     },
      //     txn,
      //   );
      // }

      return true;
    }

    return false;
  }

  /**
   * Add or un-grant point for liquidity update.
   * Grant point for adding liquidity, un-grant point for removing liquidity.
   * @param market The market object
   * @param liq The liquidity object
   * @param add Whether the liquidity is added or removed
   * @param provider The provider address
   * @param amount The liquidity amount
   * @param txn Optional transaction object
   * @returns
   */
  async grantOnLiquidityUpdate(
    market: Market,
    liq: Liquidity,
    add: boolean,
    provider: string,
    amount: bigint,
    txn?: Transaction,
  ) {
    // Only grant points to market that involves ERC20 and whose base token is not a synthetic token
    if (!market.involvesERC20() || Market.isSynth(market.baseType)) return false;

    const pointPerUnit =
      MarketPoints['liq:' + market.address] ?? MarketPoints[market.instant ? 'liq:instant' : 'liq:interactive'];

    const amountHD = toDec(amount).div(pow10(market.baseDecimals));
    const point = amountHD.mul(pointPerUnit);
    if (point.lte(0)) return false;

    const unitPerLevel = toDec(MarketPoints[`liq:level:${market.address}`] || point);
    const level = Math.max(1, point.div(unitPerLevel).toNumber()) || 1;
    const name = `${PointAction.LiquidityAdd}:${market.address}:${provider}:${liq.lid}`;
    const existingPoint = await Point.getByName(name);

    if (!existingPoint && add) {
      let actual = point.mul(level);
      if (actual.isZero() || actual.isNaN()) actual = toDec(0);

      const providerPoint = await Point.create(
        {
          network: market.network,
          name,
          address: provider,
          point: actual.toFixed(),
          action: PointAction.LiquidityAdd,
        },
        txn,
      );

      // Give provider's referrer a share of the point
      const providerUser = await User.getByAddress(provider);
      if (providerUser && providerUser.referrer) {
        await Point.create(
          {
            network: market.network,
            name: `${name}:ref`,
            address: providerUser.referrer,
            referrer: providerUser.referrer,
            referee: providerUser.address,
            point: toDec(providerPoint.point).mul(ReferrerPointSharePct).toFixed(),
            action: PointAction.LiquidityAddRef,
          },
          txn,
        );
      }
    }

    if (existingPoint && add) {
      await Point.updateById(
        existingPoint.id,
        { point: toDec(existingPoint.point).add(point.mul(level)).toFixed() },
        txn,
      );

      // Update provider's referrer share of the point
      const existingRefPoint = await Point.getByName(`${name}:ref`);
      if (existingRefPoint) {
        await Point.updateById(
          existingRefPoint.id,
          {
            point: toDec(existingRefPoint.point).add(point.mul(level).mul(ReferrerPointSharePct)).toFixed(),
          },
          txn,
        );
      }
    }

    if (existingPoint && !add) {
      await Point.updateById(
        existingPoint.id,
        { point: toDec(existingPoint.point).sub(point.mul(level)).toFixed() },
        txn,
      );

      // Update provider's referrer share of the point
      const existingRefPoint = await Point.getByName(`${name}:ref`);
      if (existingRefPoint) {
        await Point.updateById(
          existingRefPoint.id,
          {
            point: toDec(existingRefPoint.point).sub(point.mul(level).mul(ReferrerPointSharePct)).toFixed(),
          },
          txn,
        );
      }
    }

    return true;
  }

  /**
   * Grant generic point
   * @param id The point ID
   * @param net The network name
   * @param event
   * @param txn Optional transaction object
   */
  async grantPoint(id: string, net: string, recipient: string, event: ContractCallEvent, txn?: Transaction) {
    const point = MarketPoints[id];
    if (!point || point == 0) return false;

    await Point.create(
      {
        network: net,
        name: `${PointAction.Generic}:${event.transactionHash}:${recipient}`,
        address: recipient,
        point: point.toFixed(),
        action: PointAction.Generic,
      },
      txn,
    );

    // Give recipient's referrer a share of the point
    const recipientUser = await User.getByAddress(recipient);
    if (recipientUser && recipientUser.referrer) {
      await Point.create(
        {
          network: net,
          name: `${PointAction.GenericRef}:${event.transactionHash}:${recipient}:ref`,
          address: recipientUser.referrer,
          referrer: recipientUser.referrer,
          referee: recipientUser.address,
          point: toDec(point).mul(ReferrerPointSharePct).toFixed(),
          action: PointAction.GenericRef,
        },
        txn,
      );
    }

    return true;
  }
}

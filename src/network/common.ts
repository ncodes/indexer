import { BigNumber, BigNumberish } from 'ethers';
import { EnumValues } from 'enum-values';
import { toDec } from '../common/common';
import Decimal from 'decimal.js';

export enum SupportedNetworks {
  Ethereum = 'ethereum',
  Polygon = 'polygon',
  Optimism = 'optimism',
  Binance = 'binance',
  Localhost = 'localhost',
}

export enum ChainIDs {
  Ethereum = 1,
  Polygon = 137,
  Optimism = 10,
  Binance = 56,
}

// Configuration for CoinMarketCap API
export const CoinGeckoConfig = {
  networkMap: {
    ethereum: 'ethereum',
    binance: 'binance-smart-chain',
    optimism: 'optimistic-ethereum',
    polygon: 'polygon-pos',
  },
  symbolMap: {
    ETH: 'ethereum',
    BNB: 'binancecoin',
    MATIC: 'matic-network',
    BTC: 'bitcoin',
  },
};

/**
 * Get supported networks
 * @returns
 */
export function getNetworks() {
  return Object.keys(SupportedNetworks).map((s) => {
    return SupportedNetworks[s];
  });
}

/**
 * Get chain ID of a network
 * @param network
 */
export function getChainID(network: string): number {
  if (!isValidNetwork(network)) return;
  const key = EnumValues.getNameFromValue(SupportedNetworks, network);
  return ChainIDs[key];
}

/**
 * Check if a network is supported
 * @param network The network name
 * @returns
 */
export function isValidNetwork(network: string) {
  return getNetworks().includes(network);
}

/**
 * Return BigNumber equivalent of v
 * @param v
 */
export function toBN(v) {
  return BigNumber.from(v || 0);
}

// pow10 returns 10^decimals
export function pow10(decimals: number) {
  return BigNumber.from(10).pow(decimals);
}

// pow10D returns 10^decimals as a Decimal object
export function pow10D(decimals: number) {
  return toDec(10).pow(decimals);
}

// powOf returns n * 10^power
export function powOf(n: BigNumberish, power: number) {
  return toBN(
    toDec(n)
      .mul(toDec(pow10(power)))
      .toFixed(0),
  );
}

// toFixed returns n with up to places decimal places.
// If n's decimal includes only zeros, it returns n with 2 decimal places.
// Ex: if places=5, n=1.00000, toFixed(n) returns 1.00 but
// if n=1.00001, toFixed(n) returns 1.00001
export function toFixed(n: Decimal, places?: number): string {
  const n2 = n.toDP(places);
  if (n2.div(n.toFixed(0)).eq(1)) return n.toFixed(2);
  return n.toFixed();
}

// isZero checks if amt is zero or undefined
export function isZero(amt: BigNumberish) {
  return !amt || toDec(amt).eq(0);
}

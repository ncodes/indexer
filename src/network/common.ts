import { BigNumber } from 'ethers';
import { EnumValues } from 'enum-values';

export enum SupportedNetworks {
  Ethereum = 'ethereum',
  Polygon = 'polygon',
  Optimism = 'optimism',
  Binance = 'binance',
}

export enum ChainIDs {
  Ethereum = 1,
  Polygon = 137,
  Optimism = 10,
  Binance = 56,
}

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

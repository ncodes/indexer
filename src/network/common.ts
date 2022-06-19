import { BigNumber } from 'ethers';

export enum SupportedNetworks {
  EthereumMainnet = 'ethereumMainnet',
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
  return BigNumber.from(v);
}

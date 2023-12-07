import { ChainNames } from '@jointlabs/chains-info';
import Decimal from 'decimal.js';
import { BigNumber, BigNumberish, Event, Wallet } from 'ethers';
import * as moment from 'moment/moment';
import { toDec } from '../common/common';

// Map network or symbol name to corresponding CoinGecko network identifier
export const CoinGeckoConfig = {
  networkToID: {
    ethereum: 'ethereum',
    polygon: 'matic-network',
    optimism: 'optimism',
    binance: 'binancecoin',
  },
  symbolToID: {
    ETH: 'ethereum',
    MATIC: 'matic-network',
    OP: 'optimism',
    BNB: 'binancecoin',
    BTC: 'bitcoin',
  },
};

type MinerTaskDuration = {
  [key in ChainNames]?: number;
};

// MinerTaskDurations is the number of seconds a
// miner has to complete a mining task for a given network
export const MinerTaskDurations: MinerTaskDuration = {
  ethereum: 60,
  localhost: 30,
  polygon: 30,
  optimism: 30,
  sepolia: 30,
  binance: 60,
} as const;

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

/**
 * Get block time but defaults to unix time if block time is in the future
 * @param event The blockchain event
 */
export async function getBlockTime(event: Event) {
  const now = moment().unix();
  const block = await event.getBlock();
  return block.timestamp > now ? now : block.timestamp;
}

export function genEthAddress() {
  return Wallet.createRandom().address;
}

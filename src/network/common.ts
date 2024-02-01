import { ChainNames } from '@jointlabs/chains-info';
import Decimal from 'decimal.js';
import { BigNumberish, Block, TransactionResponse, Wallet } from 'ethers';
import * as moment from 'moment/moment';
import { toDec } from '../common/common';

export interface ContractCallEvent {
  event: string;
  args: any;
  blockNumber: number;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  address: string;
  eventSignature: string;
  removed: boolean;
  getBlock: () => Promise<Block>;
  getTransaction: () => Promise<TransactionResponse>;
}

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
export function toBigInt(v: number | string | bigint | Decimal) {
  return BigInt(toDec(v).toFixed(0));
}

// pow10 returns 10^decimals
export function pow10(decimals: number) {
  return toDec(10).pow(decimals);
}

// powOf returns n * 10^power
export function powOf(n: BigNumberish, power: number) {
  return toBigInt(toDec(n).mul(pow10(power)).toFixed(0));
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

/**
 * Check if a number is zero
 * @param amt The number to check
 * @returns True if amt is zero or undefined
 */
export function isZero(amt: BigNumberish) {
  return !amt || toDec(amt).eq(0);
}

/**
 * Convert a big number to number
 * @param v The number to convert
 */
export function toNumber(v: BigNumberish) {
  return toDec(v).toNumber();
}

/**
 * Get block time but defaults to unix time if block time is in the future
 * @param event The blockchain event
 */
export async function getBlockTime(event: ContractCallEvent) {
  const now = moment().unix();
  const block = await event.getBlock();
  return block.timestamp > now ? now : block.timestamp;
}

export function genEthAddress() {
  return Wallet.createRandom().address;
}

/**
 * Commify a number
 * @param value The number to commify
 * @returns
 */
export function commify(value) {
  const match = value.match(/^(-?)([0-9]*)(\.?)([0-9]*)$/);
  if (!match || (!match[2] && !match[4])) {
    throw new Error(`bad formatted number: ${JSON.stringify(value)}`);
  }

  const neg = match[1];
  const whole = BigInt(match[2] || 0).toLocaleString('en-us');
  const frac = match[4] ? match[4].match(/^(.*?)0*$/)[1] : '0';

  return `${neg}${whole}.${frac}`;
}

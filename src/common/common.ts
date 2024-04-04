import { ContractNames, getChainByName } from '@jointlabs/chains-info';
import * as crypto from 'crypto';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import Decimal from 'decimal.js';
import { BigNumberish, ethers } from 'ethers';
import * as moment from 'moment';
import * as notifier from 'node-notifier';
import { uid } from 'uid';
import * as util from 'util';

dayjs.extend(utc);

/**
 * The App Name
 * @constructor
 */
export const AppName = () => process.env.APP_NAME;

/**
 * Convert a number or string to Decimal
 * @param val The value to convert
 */
export const toDec = (val: BigNumberish | Decimal) => new Decimal(val.toString());

/**
 * Check if current environment is 'development'
 * @param ignoreDevModeEnv Only check NODE_ENV (exclude DEV_MODE)
 */
export function isDev(ignoreDevModeEnv = false) {
  return process.env.NODE_ENV === 'development' || (!ignoreDevModeEnv && process.env.DEV_MODE != undefined);
}

/**
 * Check if current environment is local (running on local machine)
 */
export function isLocal() {
  return process.env.LOCAL === 'true';
}

/**
 * Check if current environment is 'production'
 */
export function isProd() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if current environment is 'test'
 */
export function isTest() {
  return process.env.NODE_ENV === 'test';
}

/**
 * Return timezone representation of the given iso time.
 * If timezone is undefined, fallback to UTC.
 * @param isoTime The ISO time string
 * @param tz The timezone
 * @returns
 */
export function toTimezone(isoTime: string, tz: string) {
  const m = moment(isoTime);
  if (tz) m.tz(tz);
  else m.utc();
  return m;
}

/**
 * Generate a random string
 * @param len The length of the string
 */
export function randStr(len = 10) {
  return uid(len);
}

/**
 * Compare two strings (case-insensitive)
 * @param str1 The first string
 * @param str2 The second string
 */
export function isEqualStr(str1: string, str2: string) {
  if (!str1 || !str2) return false;
  return str1.toLowerCase() === str2.toLowerCase();
}

/**
 * Check if a string is included in an array of strings
 * @param arr The array of strings
 * @param str The string to check
 */
export function includesStr(arr: string[], str: string) {
  return arr.map((s) => s.toLowerCase()).includes(str.toLowerCase());
}

/**
 * Get the SHA1 hash of a string
 * @param str
 */
export function sha1(str: string) {
  const sum = crypto.createHash('sha1');
  sum.update(str);
  return sum.digest('hex');
}

/**
 * Get shortened version of an address
 * @param addr The address to shorten
 */
export function shortenAddr(addr: string) {
  return `${addr.substring(0, 4)}...${addr.substr(addr.length - 4)}`;
}

/**
 * Send a desktop notification (only in development/test mode)
 * @param format The message format
 * @param param The parameters to format the message
 */
export function notify(format: string, ...param: any[]) {
  if (isProd()) return;
  notifier.notify({
    title: 'Debug',
    message: util.format(format, ...param),
  });
}

export function randomEthAddr() {
  return ethers.Wallet.createRandom().address;
}

/**
 * Get a contract address
 * @param network The network name
 * @param name The contract name
 * @returns
 */
export function getContractsAddress(network: string, name: ContractNames) {
  return getChainByName(network).contracts[name].address;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

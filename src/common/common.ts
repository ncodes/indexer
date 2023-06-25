import * as bcrypt from 'bcrypt';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import Decimal from 'decimal.js';
import { uid } from 'uid';
import { BigNumberish } from 'ethers';

dayjs.extend(utc);

export const AppName = () => process.env.APP_NAME;
export const toDec = (val: BigNumberish) => new Decimal(val.toString());
export function isDevMode(nodeEnvOnly = false) {
  return process.env.NODE_ENV === 'development' || (!nodeEnvOnly && process.env.DEV_MODE);
}
export function isLocal() {
  return process.env.LOCAL === 'true';
}
export function isProdMode() {
  return process.env.NODE_ENV === 'production';
}
export function isTestMode() {
  return process.env.NODE_ENV === 'test';
}

export function randStr(len = 10) {
  return uid(len);
}

// isEqualStr compares two strings in lowercase
export function isEqualStr(addr1: string, addr2: string) {
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// Check if arr of lower case strings contains a string
export function includesStr(arr: string[], str: string) {
  return arr.map((s) => s.toLowerCase()).includes(str.toLowerCase());
}

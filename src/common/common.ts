import * as bcrypt from 'bcrypt';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import Decimal from 'decimal.js';
dayjs.extend(utc);

export const DecTen = new Decimal(10);
export const AppName = () => process.env.APP_NAME;
export const ToDec = (val: string | number) => new Decimal(val);
export function isDevMode(nodeEnvOnly = false) {
  return (
    process.env.NODE_ENV === 'development' ||
    (!nodeEnvOnly && process.env.DEV_MODE)
  );
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

export function hashPassword(value: string) {
  return bcrypt.hashSync(value, 10);
}

export function nowDateForEmailSub() {
  return dayjs().utc().format('YYYY-MM-DD HH:mm:ss (UTC)');
}

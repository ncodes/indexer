/* tslint:disable:no-string-literal */
import { utils } from 'ethers';
import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import Session from '../../models/session';
import User from '../../models/user';
import * as yaml from 'js-yaml';
import { sha1 } from '../../common/common';

export const SignatureError = new Error('signature is invalid or expired');

/**
 * isSignatureUnique checks if a signature is associated to a known session
 * @param signature The signature to check
 */
export async function hasSeenSignature(signature: string) {
  const existingSig = await Session.getBySignature(sha1(signature));
  return Promise.resolve(existingSig);
}

/**
 * makeSession creates a session and generates a session token
 * @param {User} user - The user object
 * @param {string} signature - The authentication signature
 * @param {string} jwtExpMin - The session token expiry time in minutes.
 * @param {string} jwtSecret - The JWT secret
 */
export async function makeSession(
  user: User,
  signature: string,
  jwtExpMin: string,
  jwtSecret: string,
): Promise<string> {
  try {
    // Ensure the signature has not been used before
    if (await hasSeenSignature(sha1(signature))) return Promise.reject(SignatureError);

    // Create session
    const session = await Session.create(user.id, sha1(signature));
    const exp = moment().add(jwtExpMin, 'minutes').unix();
    const token = jwt.sign({ exp, id: session.id, type: 'session' }, jwtSecret);

    return Promise.resolve(token);
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * Verify a signature and returned the recovered address
 * @param msg The message that was signed
 * @param sig The signature to be verified
 * @param ignoreEmail Indicate to ignore email in the message
 * @returns
 */
export function parseSignature(msg: string, sig: string, ignoreEmail = false): SignatureData {
  const rawMsg = Buffer.from(msg, 'hex');
  const hashMsg = utils.hashMessage(rawMsg.toString('utf-8'));
  const digest = utils.arrayify(hashMsg);
  const recoveredAddress = utils.recoverAddress(digest, sig);

  const lines = rawMsg.toString('utf-8').split('--');
  if (lines.length < 2) throw new Error('malformed message');

  let parsed;
  try {
    parsed = yaml.load(lines[1]) as { [k: string]: string };
  } catch (e) {
    throw new Error('malformed message');
  }
  const addressInMsg = parsed['Address'];
  if (!addressInMsg || addressInMsg.toLowerCase() !== recoveredAddress.toLowerCase())
    throw new Error('address mismatch');

  let email;
  if (!ignoreEmail) {
    email = parsed['Email'];
  }

  const ts = moment(parsed['Timestamp']);
  if (moment().diff(ts, 'minute').valueOf() >= 5) throw new Error('expired signature');

  return {
    address: recoveredAddress.toLowerCase(),
    email,
  };
}

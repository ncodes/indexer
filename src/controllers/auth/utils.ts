/* tslint:disable:no-string-literal */
import { getBytes, hashMessage, recoverAddress } from 'ethers';
import * as yaml from 'js-yaml';
import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import { sha1 } from '../../common/common';
import Session from '../../models/session';
import User from '../../models/user';

export const SignatureError = new Error('signature is invalid or expired');

/**
 * isSignatureUnique checks if a signature is associated to a known session
 * @param signature The signature to check
 */
export async function hasSeenSignature(signature: string) {
  const existingSig = await Session.getBySignature(signature);
  return Promise.resolve(existingSig);
}

/**
 * makeSession creates a session and generates a session token.
 * If signature is provided, it will be used to create the session
 * as long as it has not been used before.
 *
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
    if (signature && (await hasSeenSignature(sha1(signature)))) return Promise.reject(SignatureError);

    // Create session
    const session = await Session.create(user.id, signature ? sha1(signature) : null);
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
export function parseWalletSignature(msg: string, sig: string, ignoreEmail = false): SignatureData {
  const rawMsg = Buffer.from(msg.substring(2), 'hex');
  const hashMsg = hashMessage(rawMsg.toString('utf-8'));
  const digest = getBytes(hashMsg);
  const recoveredAddress = recoverAddress(digest, sig);

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

/**
 * Verify an OAuth state token
 * @param token The token to be verified
 * @param jwtSecret The JWT secret
 */
export function verifyOAuthStateToken(token: string, jwtSecret: string): Promise<boolean> {
  return new Promise((resolve) => {
    let valid = false;
    jwt.verify(token, jwtSecret, (err) => {
      if (err) return;
      valid = true;
    });
    resolve(valid);
  });
}

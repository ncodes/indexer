import { utils } from 'ethers';
import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import Session from '../../models/session';
import User from '../../models/user';

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
    const existingSig = await Session.getBySignature(signature);
    if (existingSig)
      return Promise.reject(new Error('signature is invalid or expired'));

    // Create session
    const session = await Session.create(user.id, signature);
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
 * @returns
 */
export function checkSignature(msg: string, sig: string) {
  const rawMsg = Buffer.from(msg, 'hex');
  const hashMsg = utils.hashMessage(rawMsg.toString('utf-8'));
  const digest = utils.arrayify(hashMsg);
  const recoveredAddress = utils.recoverAddress(digest, sig);

  // Extract address from the message and compare with the recovered address
  const lines = rawMsg.toString('utf-8').split('\n');
  const addressInMsg = lines[lines.length - 4];
  if (addressInMsg.toLowerCase() !== recoveredAddress.toLowerCase())
    throw new Error('address mismatch');

  // Verify signature timestamp; make sure it has not expired
  const ts = moment(lines[lines.length - 1]);
  if (moment().diff(ts, 'minute').valueOf() >= 5)
    throw new Error('expired signature');

  return recoveredAddress.toLowerCase();
}

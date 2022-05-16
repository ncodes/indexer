import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';
import Session from '../../models/session';
import User from '../../models/user';

/**
 * makeSession creates a session and generates a session token
 * @param {User} user - The user object
 * @param {string} jwtExpMin - The session token expiry time in minutes.
 * @param {string} jwtSecret - The JWT secret
 */
export async function makeSession(
  user: User,
  jwtExpMin: string,
  jwtSecret: string,
): Promise<string> {
  try {
    const session = await Session.create(user.id);
    const token = jwt.sign(
      {
        exp: moment().add(jwtExpMin, 'minutes').unix(),
        id: session.id,
        type: 'session',
      },
      jwtSecret,
    );
    return Promise.resolve(token);
  } catch (e) {
    return Promise.reject(e);
  }
}

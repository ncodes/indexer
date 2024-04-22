import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ErrorMessages, ErrorTypes, error } from '../common/responses/responses';
import Session from '../models/session';

export const notPermitted = error()
  .type(ErrorTypes.Auth)
  .status(HttpStatus.UNAUTHORIZED)
  .msg(ErrorMessages.NoAuthPermission);

/**
 * BeAuthenticatedGuard checks if `req.token` is valid and populates
 * `req.user` with the authenticated user object.
 */
@Injectable()
export class BeAuthenticatedGuard implements CanActivate {
  constructor(private cfg: ConfigService) {}

  canActivate(ctx: ExecutionContext): Promise<boolean> {
    return new Promise(async (res, rej) => {
      const req = ctx.switchToHttp().getRequest();
      if (!req.token || req.token === '') {
        return rej(notPermitted.build());
      }

      try {
        const session = await checkToken(this.cfg, req.token);
        req.session = session;
        req.user = session.owner;
        return res(true);
      } catch (error) {
        return rej(notPermitted.build());
      }
    });
  }
}

export async function checkToken(cfgSrv: ConfigService, token: string) {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, cfgSrv.get('auth.jwtSecret')) as jwt.JwtPayload;
  } catch (e) {
    throw new Error('Invalid token');
  }

  const session = await Session.getById(decoded.id);
  if (!session) {
    throw new Error('Invalid token');
  }

  if (!session.owner) {
    throw new Error('Invalid token');
  }

  return session;
}

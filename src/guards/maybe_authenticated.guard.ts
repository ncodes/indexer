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
 * MayBeAuthenticatedGuard checks if `req.token` is valid and populates
 * `req.user` with the authenticated user object. If not, it allows the
 * request to continue.
 */
@Injectable()
export class MayBeAuthenticatedGuard implements CanActivate {
  constructor(private cfg: ConfigService) {}

  canActivate(ctx: ExecutionContext): Promise<boolean> {
    return new Promise(async (res, rej) => {
      const req = ctx.switchToHttp().getRequest();
      if (!req.token || req.token === '') {
        return res(true);
      }

      let decoded;
      try {
        decoded = jwt.verify(req.token, this.cfg.get('auth.jwtSecret'));
      } catch (e) {
        return rej(notPermitted.build());
      }

      const session = await Session.getById(decoded.id);
      if (!session) {
        return rej(notPermitted.build());
      }

      if (!session.owner) {
        return rej(notPermitted.build());
      }

      req.user = session.owner;

      return res(true);
    });
  }
}

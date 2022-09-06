import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import * as basicAuth from 'basic-auth';
import express from 'express';
import { error, ErrorTypes } from '../common/responses/responses';

/**
 * MayHaveKeyGuard checks for auth token in either bearer or basic
 * authorization header.
 * If the header is not provided, it allows the request to continue.
 * If provided, the extracted key is added to `req.token` property.
 */
@Injectable()
export class MayHaveKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): Promise<boolean> {
    return new Promise((res, rej) => {
      const req = ctx.switchToHttp().getRequest() as express.Request;
      const auth = req.header('Authorization');

      if (!auth) {
        return res(true);
      }

      const malformedErr = error()
        .type(ErrorTypes.Auth)
        .status(HttpStatus.UNAUTHORIZED)
        .msg('authorization header is malformed');

      const authPath = auth.split(' ');
      if (authPath.length !== 2) {
        return rej(malformedErr.build());
      }

      let token;
      switch (authPath[0].toLowerCase()) {
        case 'bearer':
          token = authPath[1];
          break;
        case 'basic':
          let user;
          try {
            user = basicAuth(req);
          } catch (e) {
            return rej(malformedErr.build());
          }
          if (!user) {
            return rej(malformedErr.build());
          }
          token = user.name;
          break;
        default:
          return rej(malformedErr.build());
      }

      (req as any).token = token;
      return res(true);
    });
  }
}

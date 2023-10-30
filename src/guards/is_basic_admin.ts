import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as basicAuth from 'basic-auth';
import express from 'express';
import { ErrorTypes, error } from '../common/responses/responses';
import { notPermitted } from './be_authenticated.guard';

/**
 * IsRootAdmin checks for basic authorization header represents the root admin.
 */
@Injectable()
export class IsRootAdmin implements CanActivate {
  constructor(private cfgSrv: ConfigService) {}

  canActivate(ctx: ExecutionContext): Promise<boolean> {
    return new Promise((res, rej) => {
      const req = ctx.switchToHttp().getRequest() as express.Request;
      const auth = req.header('Authorization');

      if (!auth) {
        return rej(
          error().type(ErrorTypes.Auth).status(HttpStatus.UNAUTHORIZED).msg('authorization header is required').build(),
        );
      }

      const malformedErr = error()
        .type(ErrorTypes.Auth)
        .status(HttpStatus.UNAUTHORIZED)
        .msg('authorization header is malformed');

      const authPath = auth.split(' ');
      if (authPath.length !== 2) {
        return rej(malformedErr.build());
      }

      const user = basicAuth(req);
      if (!user) {
        return rej(malformedErr.build());
      }

      if (user.name !== this.cfgSrv.get('app.rootAdminUser') || user.pass !== this.cfgSrv.get('app.rootAdminPass')) {
        return rej(notPermitted.build());
      }

      return res(true);
    });
  }
}

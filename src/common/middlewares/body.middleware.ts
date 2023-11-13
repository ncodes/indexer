import { Injectable, NestMiddleware } from '@nestjs/common';
import { json } from 'body-parser';
import { Request, Response } from 'express';

/**
 * Copied this middleware to parse the raw response into a param to use later
 * from https://github.com/golevelup/nestjs/blob/master/packages/webhooks/src/webhooks.middleware.ts
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  public use(req: any, res: Response<any>, next: () => any): any {
    json({
      verify: (req: any, res, buffer) => {
        if (Buffer.isBuffer(buffer)) {
          const rawBody = Buffer.from(buffer);
          req.parsedRawBody = rawBody;
        }
        return true;
      },
    })(req, res as any, next);
  }
}

// tslint:disable-next-line:max-classes-per-file
@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => any) {
    json()(req as any, res as any, next);
  }
}

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, baseUrl, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    this.logger.log(`Request: ${method} ${baseUrl} ${originalUrl} - ${userAgent} ${ip}`);

    response.on('close', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      this.logger.log(
        `Response: ${method} ${baseUrl} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip}`,
      );
    });

    next();
  }
}

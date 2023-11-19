import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import express from 'express';
import { isProd } from '../common';
import { handleAxiosError } from '../errors/http_response_error';
import { ErrorTypes, error } from '../responses/responses';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private logger = new Logger(AllExceptionsFilter.name);

  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: express.Response = ctx.getResponse();

    if (e instanceof HttpException) {
      return response.status(e.getStatus()).json(e.getResponse());
    }

    let msg = (e as Error).message;
    if (isProd()) {
      this.logger.error(isAxiosError(e) ? handleAxiosError(e).message : msg);
      msg = 'server error';
    }

    const err = error(e as Error)
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type(ErrorTypes.Server)
      .msg(msg)
      .build();

    this.logger.error(e);

    return response.status(err.getStatus()).json(err.getResponse());
  }
}

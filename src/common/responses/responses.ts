import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as _ from 'lodash';
import { isDev } from '../common';

export class ErrorBuilder {
  private logger = new Logger(ErrorBuilder.name);
  private _status: number;
  private readonly _data: any;

  constructor(public e?: Error) {
    this._data = {};
  }

  status(status: number) {
    this._status = status;
    return this;
  }

  msg(msg: string) {
    if (msg !== '') this._data.message = msg;
    return this;
  }

  meta(k: string, value: any) {
    if (!this._data.meta) this._data.meta = {};
    if (k !== '') this._data.meta[k] = value;
    return this;
  }

  code(code: string) {
    if (code !== '') this._data.code = code;
    return this;
  }

  param(param: string) {
    if (param !== '') this._data.param = param;
    return this;
  }

  type(type: string) {
    if (type !== '') this._data.type = type;
    return this;
  }

  getObj() {
    return { error: this._data };
  }

  build() {
    if (isDev()) console.error('Error: ', this._data);
    return buildHttpException(this.getObj(), this._status);
  }

  json() {
    return JSON.stringify(this.build());
  }

  throw() {
    if (this.logger !== undefined) {
      const err = this.getObj();
      if (this.e !== undefined) {
        (err as any).real = this.e.message;
        (err as any).stack = this.e.stack;
      }
      this.logger.error(err);
    }
    throw this.build();
  }
}

export function buildHttpException(obj: any, status: number) {
  return new HttpException(HttpException.createBody(obj, undefined, status), status);
}

/**
 * error returns a builder for creating an error response
 */
export function error(e?: Error) {
  return new ErrorBuilder(e);
}

// tslint:disable-next-line:max-classes-per-file
class OKBuilder {
  private _status: number;
  private res: Response;
  private readonly _data: { [key: string]: any };

  constructor(res?: Response) {
    this._data = {};
    this.res = res;
  }

  status(status: number) {
    this._status = status;
    return this;
  }

  data(data: any) {
    this._data.data = data;
    return this;
  }

  object(object: string) {
    if (object !== '') {
      this._data.object = object;
    }
    return this;
  }

  meta(data: any) {
    this._data.meta = data;
    return this;
  }

  extractMeta() {
    const data = this._data.data;
    if (_.isArray(data)) {
      (data as any[]).forEach((d) => {
        const keys = _.filter(_.keys(d), (k) => {
          return k.startsWith('$');
        });

        if (!this._data.meta) this._data.meta = {};
        keys.forEach((k) => {
          this._data.meta[k.substring(1)] = d[k];
          delete d[k];
        });

        if (Object.keys(this._data.meta).length === 0) delete this._data.meta;
      });
    }
  }

  build<T>(): Promise<T> {
    this.extractMeta();
    if (!this.res) return HttpException.createBody(this._data as any, undefined, this._status) as unknown as Promise<T>;
    this.res.status(this._status || HttpStatus.CREATED).json(this._data);
  }
}

/**
 * ok returns a builder for create a success response
 */
export function ok(res?: Response) {
  return new OKBuilder(res);
}

export enum ErrorTypes {
  Server = 'api_error',
  InvalidRequest = 'invalid_request_error',
  Auth = 'authentication_error',
  Perm = 'permission_error',
}

/**
 * Common error messages
 */
export enum ErrorMessages {
  NoAuthPermission = 'not permitted to perform this action',
  UserNotFound = 'user not found',
}

/**
 * Build 404 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function build404(msg: string, type?: string, param?: string) {
  return error().status(HttpStatus.NOT_FOUND).param(param).type(type).msg(msg).build();
}

/**
 * Throw 404 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function throw404(msg: string, type?: string, param?: string) {
  throw build404(msg, type, param);
}

/**
 * Throw 403 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function throw403(msg: string, type?: string, param?: string) {
  throw error().status(HttpStatus.FORBIDDEN).param(param).type(type).msg(msg).build();
}

/**
 * Build 400 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function build400(msg: string, type?: string, param?: string) {
  return error()
    .status(HttpStatus.BAD_REQUEST)
    .param(param)
    .type(type || ErrorTypes.InvalidRequest)
    .msg(msg)
    .build();
}

/**
 * Throw 400 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function throw400(msg: string, type?: string, param?: string) {
  throw build400(msg, type, param);
}

/**
 * Build 401 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function build401(msg: string, type?: string, param?: string) {
  return error()
    .status(HttpStatus.UNAUTHORIZED)
    .param(param)
    .type(type || ErrorTypes.Auth)
    .msg(msg)
    .build();
}

/**
 * Build 500 HTTPException
 * @param msg The error message
 * @constructor
 */
export function build500(msg: string) {
  return error().status(HttpStatus.INTERNAL_SERVER_ERROR).msg(msg).build();
}

/**
 * Throw 401 HTTPException
 * @param msg The error message
 * @param type The type of error
 * @param param The target param/field name causing the error
 * @constructor
 */
export function throw401(msg: string, type?: string, param?: string) {
  throw build401(msg, type, param);
}

/**
 * Throw 500 HTTPException
 * @param msg The error message
 * @constructor
 */
export function throw500(msg: string) {
  throw build500(msg);
}

export const ErrServerError = error()
  .status(HttpStatus.INTERNAL_SERVER_ERROR)
  .type(ErrorTypes.Server)
  .msg('server error')
  .build();

export const ErrBadSignature = build401('signature is invalid or expired', ErrorTypes.Auth, 'sig');

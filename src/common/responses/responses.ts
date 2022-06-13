import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { isDevMode } from '../common';
import * as _ from 'lodash';

class ErrorBuilder {
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
    if (isDevMode()) console.error('Error: ', this._data);
    return new HttpException(
      HttpException.createBody(this.getObj(), undefined, this._status),
      this._status,
    );
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

/**
 * error returns a builder for creating an error response
 */
export function error(e?: Error) {
  return new ErrorBuilder(e);
}

// tslint:disable-next-line:max-classes-per-file
class OKBuilder {
  private _status: number;
  private readonly _data: { [key: string]: any };

  constructor() {
    this._data = {};
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
          return k.substr(0, 2) === '__';
        });

        if (!this._data.meta) this._data.meta = {};
        keys.forEach((k) => {
          this._data.meta[k.substr(2)] = d[k];
          delete d[k];
        });
      });
    }
  }

  build<T>(): Promise<T> {
    this.extractMeta();
    return HttpException.createBody(this._data, undefined, this._status) as unknown as Promise<T>;
  }
}

/**
 * ok returns a builder for create a success response
 */
export function ok() {
  return new OKBuilder();
}

export enum ErrorTypes {
  Server = 'api_error',
  InvalidRequest = 'invalid_request_error',
  Auth = 'authentication_error',
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

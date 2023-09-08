import { AxiosResponse } from 'axios';

export class RequestError extends Error {
  constructor(public code: number, public message: string) {
    super(message);
    Object.setPrototypeOf(this, RequestError.prototype);
  }

  public toString = (): string => {
    return `RequestError: ${this.message}`;
  };
}

export function handleAxiosError(error: { response: AxiosResponse; request: unknown }): RequestError {
  if (error.response) {
    return new RequestError(error.response.status, (error.response as AxiosResponse).data);
  } else if (error.request) {
    return new RequestError(500, 'request error');
  } else {
    console.error(error);
    return new RequestError(500, 'something went wrong');
  }
}

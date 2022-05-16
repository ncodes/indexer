import User from '../src/models/user';

declare global {
  namespace Express {
    export interface Request {
      user: User;
      parsedRawBody: Buffer;
    }
  }

  interface SentResponse {
    sent: boolean;
  }

  interface OKResponse {
    ok: boolean;
  }

  interface AnObject {
    [key: string]: any;
  }
}

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

  interface KnownContracts {
    p2pToken?: Contract;
    marketCore?: Contract;
    core?: Contract;
    mediatorMgr?: Contract;
    disputeMgr?: Contract;
    p2pStaker?: Contract;
    lpStaker?: Contract;
    feeSharer?: Contract;
  }

  interface ContractMarket {
    creator: string;
    createdAt: number;
    baseAsset: {
      addr: string;
      isLocal: boolean;
    };
    quoteAsset: {
      addr: string;
      isLocal: boolean;
    };
    numOrders: number;
    numDisputes: number;
    permPut: boolean;
    permSwap: boolean;
    permMediate: boolean;
    commission: number;
    numMediators: number;
    mediatorBond: number;
  }
}

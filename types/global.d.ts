import User from '../src/models/user';
import { BigNumber, Contract } from 'ethers';
import { NotifyType } from '../src/jobs/mailer/NotifierService';

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

  interface CountResponse {
    count: string;
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
    createdAt: BigNumber;
    baseAsset: {
      addr: string;
      isLocal: boolean;
    };
    quoteAsset: {
      addr: string;
      isLocal: boolean;
    };
    numOrders: BigNumber;
    numDisputes: BigNumber;
    permPut: boolean;
    permSwap: boolean;
    permMediate: boolean;
    commission: BigNumber;
    numMediators: BigNumber;
    mediatorBond: BigNumber;
  }

  interface ContractLiquidity {
    amount: BigNumber;
    price: BigNumber;
    minSwap: BigNumber;
    maxSwap: BigNumber;
    timeToPay: BigNumber;
    openOrders: BigNumber;
    paused: boolean;
  }

  interface NotifyJob {
    notifType: NotifyType;
    network: string;
    recipient: string;
    user: User;
    data: { [key: string]: string };
  }
}

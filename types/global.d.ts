import {
  ChainLinkParams,
  CoreParams,
  DisputeManagerParams,
  MarketCoreParams,
  MediatorManagerParams,
  MinerRegistryParams,
  OthersParams,
} from '@jointlabs/chains-info/src/types';
import { BigNumber } from 'ethers';
import { NotificationID } from '../src/jobs/notifications/common';
import Convo from '../src/models/convo';
import Dispute from '../src/models/dispute';
import Liquidity from '../src/models/liquidity';
import Market from '../src/models/market';
import Offer from '../src/models/offer';
import Session from '../src/models/session';
import Swap from '../src/models/swap';
import Ticket from '../src/models/ticket';
import User from '../src/models/user';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  Energon,
  FeePool,
  LPPool,
  MarketCore,
  MediatorManager,
  MinerRegistry,
  NFT,
  Token,
  TokenPool,
} from '../typechain';

declare global {
  namespace Express {
    export interface Request {
      user: User;
      session: Session;
      parsedRawBody: Buffer;
    }
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

  interface JointContracts {
    p2pToken?: Token;
    marketCore?: MarketCore;
    core?: Core;
    mediatorMgr?: MediatorManager;
    disputeMgr?: DisputeManager;
    badgeMgr?: BadgeManager;
    tokenPool?: TokenPool;
    lpPool?: LPPool;
    feePool?: FeePool;
    assetRegistry?: AssetRegistry;
    minerRegistry?: MinerRegistry;
    energon?: Energon;
    nft?: NFT;
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
    numDisputes: BigNumber;
    permPut?: boolean;
    permSwap?: boolean;
    permMediate?: boolean;
    commission: BigNumber;
    numMediators?: BigNumber;
    mediatorBond?: BigNumber;
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

  interface NotifyJob<T> {
    notifId: NotificationID;
    network: string;
    recipientAddr: string;
    appUrl: string;
    user?: User;
    data: T;
  }

  interface TokenMetadata {
    logoURI: string;
    network: string;
    symbol: string;
    type: string;
    name: string;
    decimals: number;
    price?: number;
    isContract?: boolean;
    address?: string;
    chainId?: number;
  }

  interface SignatureData {
    address: string;
    email: string;
  }

  interface AssetStat {
    symbol?: string;
    address?: string;
    volume24h?: string;
    price24h?: number;
    lowestPrice24h?: string;
    highestPrice24h?: string;
    network?: string;
    dominantColor?: string;
  }

  namespace TokenList {
    interface TokenData {
      name: string;
      logoURI: string;
      timestamp: string;
      tokens: Token[];
      version: Version;
    }

    interface Token {
      asset?: string;
      type?: string | 'ERC20' | 'SYNTHETIC';
      address?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
      logoURI?: string;
      disabled?: boolean;
      price?: number; // Used in dev mode only
      isSynthetic?: boolean; // Used to identify synthetic tokens
    }

    interface Version {
      major: number;
      minor: number;
      patch: number;
    }
  }

  type ContractsParams = CoreParams &
    MarketCoreParams &
    MediatorManagerParams &
    DisputeManagerParams &
    MinerRegistryParams &
    ChainLinkParams &
    OthersParams;

  export interface InstantSwapNotificationData {
    market: Market;
    swap: Partial<Swap>;
    liq: Liquidity;
  }

  export interface SwapOrderNotificationData {
    marketAddress: string;
    provider: string;
    swapper: string;
    swap: Partial<Swap>;
    market: Market;
  }

  interface CancelledOrderNotification {
    market: Market;
    liq: Liquidity;
    swap: Swap;
  }

  interface OrderReleasedNotification {
    market: Market;
    liq: Liquidity;
    swap: Swap;
  }

  interface OrderPaidNotification {
    swap: Swap;
    market: Market;
  }

  interface PutApprovedNotification {
    market: Market;
  }

  interface PutRevokedNotification {
    market: Market;
  }

  interface SwapApprovedNotification {
    market: Market;
  }

  interface SwapRevokedNotification {
    market: Market;
  }

  interface UpdatedLiquidityManagerNotification {
    market: Market;
    provider: string;
  }

  interface RemoveLiquidityManagerNotification {
    market: Market;
    provider: string;
  }

  interface DisputeCreatedNotification {
    dispute: Dispute;
    swap: Swap;
  }

  interface TicketDraftedNotification {
    owner: string;
    ticketId: number;
    dispute: Dispute;
  }

  interface FullyDraftedNotification {
    dispute: Dispute;
    evidencePhaseHoursLeft: string;
  }

  interface TicketSlashedNotification {
    ticket: Ticket;
    owner: string;
    amount: string;
    voted: boolean;
    asset: string;
  }

  interface EvidencePeriodEndedNotification {
    swap: Swap;
    disputeId: number;
    commitPhaseHoursLeft: string;
    drafted: boolean;
  }

  interface CommitPhaseEndedNotification {
    swap: Swap;
    disputeId: number;
    drafted: boolean;
    revealPhaseHoursLeft: string;
  }

  interface RevealPhaseEndedNotification {
    swap: Swap;
    disputeId: number;
    participant: boolean;
    nRelease: number;
    nCancel: number;
    numMediators: number;
    majority: number;
    cost: string;
    appealPhaseHoursLeft: string;
  }

  interface DisputeExecutedNotification {
    swap: Swap;
    dispute: Dispute;
    drafted: boolean;
  }

  interface BaseOfferNotification {
    offer: Offer;
    market: Market;
    liq: Liquidity;
  }

  interface ChatNewMessageNotification {
    user: User;
    convo: Convo;
  }

  interface VerifyNewEmailNotification {
    user: User;
    otp: string;
  }

  interface NewUpdatedOfferNotification extends BaseOfferNotification {
    updated: boolean;
  }

  interface PoolParams {
    poolId?: number;
    reqBond?: string;
    draftReward?: string;
    winReward?: string;
    noVoteSlashBP?: string;
    loseVoteSlashBP?: string;
    numDraftees?: number;
    evidenceDur?: number;
    predictDur?: number;
    approvedMediatorOnly?: boolean;
    approvedMarketOnly?: boolean;
  }

  type Instructions = {
    global: string;
    liquidity: { [key: string]: string };
  };

  interface GrantSigInfo {
    sig?: string;
    isNew?: boolean;
    values?: any[];
    network?: string;
  }
}

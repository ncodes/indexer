import User from '../src/models/user';
import { BigNumber } from 'ethers';
import { NotificationID } from '../src/jobs/mailer/NotifierService';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  FeePool,
  LPPool,
  MarketCore,
  MediatorManager,
  Token,
  TokenPool,
} from '../typechain';
import Market from '../src/models/market';
import Swap from '../src/models/swap';
import Liquidity from '../src/models/liquidity';
import Dispute from '../src/models/dispute';
import Ticket from '../src/models/ticket';
import Offer from '../src/models/offer';

declare global {
  namespace Express {
    export interface Request {
      user: User;
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
    notifType: NotificationID;
    network: string;
    recipient: string;
    appUrl: string;
    user?: User;
    data: T;
  }

  interface TokenMetadata {
    logoURI: string;
    network: string;
    name: string;
    decimals: number;
    price?: number;
    isContract?: boolean;
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
      price?: number; // Used in dev mode only
      isSynthetic?: boolean; // Used to identify synthetic tokens
    }

    interface Version {
      major: number;
      minor: number;
      patch: number;
    }
  }

  interface ContractsParams {
    // Core params
    minTimeToPay: number;
    orderGraceDur: number;
    maxOpenOrders: number;
    maxOpenDisputes: number;
    transferToFeePoolInterval: number;
    nftDiscountBP: number;

    // Market manager params
    baseTicketPrice: number;
    ticketWindowDur: number;
    ticketsPerWindow: number;
    ticketSupply: number;
    priceSupplyDeltaBP: number;
    minInactiveWindowBeforeReset: number;
    soldOutBP: number;
    ticketMatureDur: number;
    ticketCancelDur: number;
    ticketExpireDur: number;
    noVoteSlashBP: number;
    loseVoteSlashBP: number;

    // Dispute manager params
    rewardWindowAlloc: BigNumber;
    rewardWindowDur: number;
    redeemWindowRewardDur: number;
    predictDur: number;
    appealDur: number;
    evidenceDur: number;
    disputeCost: number;
    maxMediatorPerDispute: number;

    // Chainlink params
    chainlinkKeyHash: string;
    chainlinkCoordinator: string;
    chainlinkSubId: number;

    // Operator params
    operatorBond: BigNumber;

    // Others
    safe: string;
    allocatorAddr: string;
  }

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

  interface MediatorInviteReceivedNotification {
    market: Market;
  }

  interface MediatorInviteAcceptedNotification {
    market: Market;
    invitee: string;
  }

  interface MediatorRevokedNotification {
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

  interface NewTicketJoinedPoolNotification {
    market: Market;
    owner: string;
    numTickets: string;
  }

  interface NewTicketLeftMarketNotification {
    market: Market;
    owner: string;
    numTickets: string;
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

  interface NewUpdatedOfferNotification extends BaseOfferNotification {
    updated: boolean;
  }

  interface PoolParams {
    poolId: number;
    reqBond: string;
    draftReward: string;
    winReward: string;
    noVoteSlashBP: string;
    loseVoteSlashBP: string;
    numDraftees: number;
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

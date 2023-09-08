import { parseInt } from 'lodash';

function getContractsParams(): ContractsParams {
  return {
    defaultDisputeDelayDur: parseInt(process.env[`MC_DEFAULT_DISPUTE_DELAY_DUR`]),
    minTimeToPay: parseInt(process.env[`OC_MIN_TIME_TO_PAY`]),
    orderGraceDur: parseInt(process.env[`OC_ORDER_GRACE_DUR`]),
    maxOpenOrders: parseInt(process.env[`OC_MAX_OPEN_ORDERS`]),
    maxOpenDisputes: parseInt(process.env[`OC_MAX_OPEN_DISPUTES`]),
    transferToFeePoolInterval: parseInt(process.env[`OC_TRANSFER_TO_FEE_POOL_INTERVAL`]),
    nftDiscountBP: parseInt(process.env[`OC_NFT_DISCOUNT_BP`]),

    baseTicketPrice: process.env[`MM_BASE_TICKET_PRICE`],
    ticketWindowDur: parseInt(process.env[`MM_TICKET_WINDOW_DUR`]),
    ticketsPerWindow: parseInt(process.env[`MM_TICKETS_PER_WINDOW`]),
    ticketSupply: parseInt(process.env[`MM_TICKET_SUPPLY`]),
    priceSupplyDeltaBP: parseInt(process.env[`MM_PRICE_SUPPLY_DELTA_BP`]),
    minInactiveWindowBeforeReset: parseInt(process.env[`MM_MIN_INACTIVE_WINDOW_BEFORE_RESET`]),
    soldOutBP: parseInt(process.env[`MM_SOLD_OUT_BP`]),
    ticketMatureDur: parseInt(process.env[`MM_TICKET_MATURE_DUR`]),
    ticketCancelDur: parseInt(process.env[`MM_TICKET_CANCEL_DUR`]),
    ticketExpireDur: parseInt(process.env[`MM_TICKET_EXPIRE_DUR`]),
    noVoteSlashBP: parseInt(process.env[`MM_NO_VOTE_SLASH_BP`]),
    loseVoteSlashBP: parseInt(process.env[`MM_LOSE_VOTE_SLASH_BP`]),

    evidenceDur: parseInt(process.env[`DM_EVIDENCE_DUR`]),
    predictDur: parseInt(process.env[`DM_PREDICT_DUR`]),

    operatorBond: process.env[`OP_OPERATOR_BOND`],
  };
}

function getContractsAddress() {
  return {
    rpcUrl: process.env[`RPC_URL`],
    p2pTokenAddr: process.env[`TOKEN_ADDRESS`],
    marketCoreAddr: process.env[`MARKET_CORE_ADDRESS`],
    coreAddr: process.env[`CORE_ADDRESS`],
    mediatorMgrAddr: process.env[`MEDIATOR_MGR_ADDRESS`],
    disputeMgrAddr: process.env[`DISPUTE_MGR_ADDRESS`],
    tokenPoolAddr: process.env[`TOKEN_POOL_ADDRESS`],
    lpPoolAddr: process.env[`LP_POOL_ADDRESS`],
    feePoolAddr: process.env[`FEE_POOL_ADDRESS`],
    badgeMgrAddr: process.env[`BADGE_MGR_ADDRESS`],
    assetRegAddr: process.env[`ASSET_REG_ADDRESS`],
  };
}

export default () => ({
  app: {
    network: process.env.NETWORK,
    nodeEnv: process.env.NODE_ENV,
    url: process.env.URL,
    appUrl: process.env.APP_URL,
    throttle_ttl: process.env.THROTTLE_TTL,
    throttle_limit: process.env.THROTTLE_LIMIT,
    rootAdminUser: process.env.ROOT_ADMIN_USER,
    rootAdminPass: process.env.ROOT_ADMIN_PASS,
    disableNotifications: process.env.DISABLE_NOTIFICATIONS,
    tokenMetadataSource: process.env.TOKEN_METADATA_SOURCE,
    exchangeRateSource: process.env.EXCHANGE_RATE_SOURCE,
    redis: {
      url: process.env.REDIS_URL,
    },
    cmc: {
      key: process.env.COINMARKETCAP_KEY,
    },
    openexchangerates: {
      key: process.env.OPENEXRATES_KEY,
    },
    fastforex: {
      key: process.env.FASTFOREX_KEY,
    },
    pinata: {
      key: process.env.PINATA_JWT_KEY,
    },
    ipfs: {
      gateway: process.env.IPFS_GATEWAY,
    },
    aws: {
      smtpUsername: process.env.AWS_SMTP_USERNAME,
      smtpPassword: process.env.AWS_SMTP_PASSWORD,
    },
    contractsAddress: getContractsAddress(),
    contractsParams: getContractsParams(),
    badges: {
      merchant: process.env.MERCHANT_BADGE,
      kyc: process.env.KYC_BADGE,
      instruction: process.env.INSTRUCTION_BADGE,
      instructionIssuerPk: process.env.INSTRUCTION_BADGE_ISSUER_PK,
    },
  },
});

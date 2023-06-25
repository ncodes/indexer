function getContractsParams(network: string) {
  network = network.toUpperCase();
  return {
    minTimeToPay: process.env[`${network}_OC_MIN_TIME_TO_PAY`],
    orderGraceDur: process.env[`${network}_OC_ORDER_GRACE_DUR`],
    maxOpenOrders: process.env[`${network}_OC_MAX_OPEN_ORDERS`],
    maxOpenDisputes: process.env[`${network}_OC_MAX_OPEN_DISPUTES`],
    transferToFeePoolInterval: process.env[`${network}_OC_TRANSFER_TO_FEE_POOL_INTERVAL`],
    baseTicketPrice: process.env[`${network}_MM_BASE_TICKET_PRICE`],
    ticketWindowDur: process.env[`${network}_MM_TICKET_WINDOW_DUR`],
    ticketsPerWindow: process.env[`${network}_MM_TICKETS_PER_WINDOW`],
    ticketSupply: process.env[`${network}_MM_TICKET_SUPPLY`],
    priceSupplyDeltaBP: process.env[`${network}_MM_PRICE_SUPPLY_DELTA_BP`],
    minInactiveWindowBeforeReset: process.env[`${network}_MM_MIN_INACTIVE_WINDOW_BEFORE_RESET`],
    soldOutBP: process.env[`${network}_MM_SOLD_OUT_BP`],
    ticketMatureDur: process.env[`${network}_MM_TICKET_MATURE_DUR`],
    ticketCancelDur: process.env[`${network}_MM_TICKET_CANCEL_DUR`],
    minTicketTenureDur: process.env[`${network}_MM_MIN_TICKET_TENURE_DUR`],
    ticketExpireDur: process.env[`${network}_MM_TICKET_EXPIRE_DUR`],
    maxMediators: process.env[`${network}_MM_MAX_MEDIATORS`],
    noVoteSlashBP: process.env[`${network}_MM_NO_VOTE_SLASH_BP`],
    loseVoteSlashBP: process.env[`${network}_MM_LOSE_VOTE_SLASH_BP`],
    rewardWindowAlloc: process.env[`${network}_DM_REWARD_WINDOW_ALLOC`],
    rewardWindowDur: process.env[`${network}_DM_REWARD_WINDOW_DUR`],
    redeemWindowRewardDur: process.env[`${network}_DM_REDEEM_WINDOW_REWARD_DUR`],
    appealDur: process.env[`${network}_DM_APPEAL_DUR`],
    evidenceDur: process.env[`${network}_DM_EVIDENCE_DUR`],
    predictDur: process.env[`${network}_DM_PREDICT_DUR`],
    disputeCost: process.env[`${network}_DM_DISPUTE_COST`],
    maxMediatorPerDispute: process.env[`${network}_DM_MAX_MEDIATOR_PER_DISPUTE`],
    operatorBond: process.env[`${network}_OP_OPERATOR_BOND`],
  };
}

function getContractsAddress(network: string) {
  network = network.toUpperCase();
  return {
    rpcUrl: process.env[`${network}_RPC_URL`],
    p2pTokenAddr: process.env[`${network}_TOKEN_ADDRESS`],
    marketCoreAddr: process.env[`${network}_MARKETCORE_ADDRESS`],
    coreAddr: process.env[`${network}_CORE_ADDRESS`],
    mediatorMgrAddr: process.env[`${network}_MEDIATOR_MGR_ADDRESS`],
    disputeMgrAddr: process.env[`${network}_DISPUTE_MGR_ADDRESS`],
    tokenPoolAddr: process.env[`${network}_TOKEN_POOL_ADDRESS`],
    lpPoolAddr: process.env[`${network}_LP_POOL_ADDRESS`],
    feePoolAddr: process.env[`${network}_FEE_POOL_ADDRESS`],
    badgeMgrAddr: process.env[`${network}_BADGE_MGR_ADDRESS`],
    assetRegAddr: process.env[`${network}_ASSET_REG_ADDRESS`],
  };
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV,
    url: process.env.URL,
    appUrl: process.env.APP_URL,
    throttle_ttl: process.env.THROTTLE_TTL,
    throttle_limit: process.env.THROTTLE_LIMIT,
    rootAdminUser: process.env.ROOT_ADMIN_USER,
    rootAdminPass: process.env.ROOT_ADMIN_PASS,
    disableNotifications: process.env.DISABLE_NOTIFICATIONS,
    tokenMetadataSource: process.env.TOKEN_METADATA_SOURCE,
    redis: {
      url: process.env.REDIS_URL,
    },
    cmc: {
      key: process.env.COINMARKETCAP_KEY,
    },
    openexchangerate: {
      key: process.env.OPENEXRATE_KEY,
    },
    aws: {
      smtpUsername: process.env.AWS_SMTP_USERNAME,
      smtpPassword: process.env.AWS_SMTP_PASSWORD,
    },
    telegram: {
      apiId: process.env.TG_API_ID,
      apiHash: process.env.TG_API_HASH,
      phoneNumber: process.env.TG_PHONE_NUMBER,
    },
    networks: {
      ethereum: getContractsAddress('ethereum'),
      localhost: getContractsAddress('localhost'),
    },
    contractsParams: {
      localhost: getContractsParams('localhost'),
      ethereum: getContractsParams('ethereum'),
    },
  },
});

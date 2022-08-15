export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV,
    url: process.env.URL,
    throttle_ttl: process.env.THROTTLE_TTL,
    throttle_limit: process.env.THROTTLE_LIMIT,
    rootAdminUser: process.env.ROOT_ADMIN_USER,
    rootAdminPass: process.env.ROOT_ADMIN_PASS,
    redis: {
      url: process.env.REDIS_URL,
    },
    nomics: {
      key: process.env.NOMICS_KEY,
    },
    cmc: {
      key: process.env.CMC_KEY,
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
      ethereum: {
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        p2pTokenAddr: process.env.ETHEREUM_P2P_TOKEN,
        marketCoreAddr: process.env.ETHEREUM_MARKETCORE_ADDRESS,
        coreAddr: process.env.ETHEREUM_CORE_ADDRESS,
        mediatorMgrAddr: process.env.ETHEREUM_MEDIATOR_MGR_ADDRESS,
        disputeMgrAddr: process.env.ETHEREUM_DISPUTE_MGR_ADDRESS,
        p2pStakerAddr: process.env.ETHEREUM_P2P_STAKER_ADDRESS,
        lpStakerAddr: process.env.ETHEREUM_LP_STAKER_ADDRESS,
        feeSharerAddr: process.env.ETHEREUM_FEE_SHARER_ADDRESS,
      },
    },
    contractsParams: {
      ethereum: {
        transferToFeeSharerReward: process.env.OC_TRANSFER_TO_FEE_SHARER_REWARD,
        transferToFeeSharerInterval: process.env.OC_TRANSFER_TO_FEE_SHARER_INTERVAL,
        ticketMatureDur: process.env.MM_TICKET_MATURE_DUR,
        ticketCancelDur: process.env.MM_TICKET_CANCEL_DUR,
        minTicketTenureDur: process.env.MM_MIN_TICKET_TENURE_DUR,
        ticketExpireDur: process.env.MM_TICKET_EXPIRE_DUR,
        maxMediators: process.env.MM_MAX_MEDIATORS,
        noVoteSlashBP: process.env.MM_NO_VOTE_SLASH_BP,
        loseVoteSlashBP: process.env.MM_LOSE_VOTE_SLASH_BP,
        draftReward: process.env.DM_DRAFT_REWARD,
        predictDur: process.env.DM_PREDICT_DUR,
        appealDur: process.env.DM_APPEAL_DUR,
        evidenceDur: process.env.DM_EVIDENCE_DUR,
        execDecisionReward: process.env.DM_EXEC_DECISION_REWARD,
        disputeCost: process.env.DM_DISPUTE_COST,
        maxMediatorPerDispute: process.env.DM_MAX_MEDIATOR_PER_DISPUTE,
      },
    },
  },
});

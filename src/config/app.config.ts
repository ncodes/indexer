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
  },
});

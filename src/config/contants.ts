const Envs = {
  disableNotificationsProcessing: process.env.DISABLE_NOTIFICATIONS_PROCESSING,
  disableDisputeNotifiers: process.env.DISABLE_DISPUTE_NOTIFIERS,
  disableCurrencyRateFetcher: process.env.DISABLE_CURRENCY_RATE_FETCHER,
  enableMarketMetaManager: process.env.ENABLE_MARKET_META_MANAGER,
  enableProviderMsgStatusUpdate: process.env.ENABLE_PROVIDER_MSG_STATUS_UPDATE,
  marketManagerCronTime: process.env.MARKET_MGR_CRON,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
};

export default Envs;

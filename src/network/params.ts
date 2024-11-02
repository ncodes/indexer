import { ChainNames, getContractsParams } from '@jointlabs/meta';

export function getNetworkParams(network: ChainNames): ContractsParams {
  return {
    minTimeToPay: getContractsParams(network).core.minTimeToPay,
    orderGraceDur: getContractsParams(network).core.orderGraceDur,
    maxOpenOrders: getContractsParams(network).core.maxOpenOrders,
    maxOpenDisputes: getContractsParams(network).core.maxOpenDisputes,
    transferToFeePoolInterval: getContractsParams(network).core.transferToFeePoolInterval,
    defaultDisputeDelayDur: getContractsParams(network).marketCore.defaultDisputeDelayDur,
    baseTicketPrice: getContractsParams(network).mediatorManager.baseTicketPrice,
    ticketWindowDur: getContractsParams(network).mediatorManager.ticketWindowDur,
    ticketsPerWindow: getContractsParams(network).mediatorManager.ticketsPerWindow,
    ticketSupply: getContractsParams(network).mediatorManager.ticketSupply,
    priceSupplyDeltaBP: getContractsParams(network).mediatorManager.priceSupplyDeltaBP,
    minInactiveWindowBeforeReset: getContractsParams(network).mediatorManager.minInactiveWindowBeforeReset,
    soldOutBP: getContractsParams(network).mediatorManager.soldOutBP,
    ticketMatureDur: getContractsParams(network).mediatorManager.ticketMatureDur,
    ticketCancelDur: getContractsParams(network).mediatorManager.ticketCancelDur,
    ticketPauseDur: getContractsParams(network).mediatorManager.ticketPauseDur,
    ticketExpireDur: getContractsParams(network).mediatorManager.ticketExpireDur,
    reqPoolBond: getContractsParams(network).mediatorManager.reqPoolBond,
    poolDraftReward: getContractsParams(network).mediatorManager.poolDraftReward,
    poolWinReward: getContractsParams(network).mediatorManager.poolWinReward,
    poolNumDraftee: getContractsParams(network).mediatorManager.poolNumDraftee,
    poolNoVoteSlashBP: getContractsParams(network).mediatorManager.poolNoVoteSlashBP,
    poolLoseVoteSlashBP: getContractsParams(network).mediatorManager.poolLoseVoteSlashBP,
    evidenceDur: getContractsParams(network).disputeManager.evidenceDur,
    predictDur: getContractsParams(network).disputeManager.predictDur,
    operatorBond: getContractsParams(network).others.operatorBond,
  };
}

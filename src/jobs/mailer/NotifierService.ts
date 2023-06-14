import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

export enum NotificationID {
  MediatorInviteReceived = 'MediatorInviteReceived',
  MediatorInviteAccepted = 'MediatorInviteAccepted',
  MediatorRevoked = 'MediatorRevoked',
  PutApproved = 'PutApproved',
  PutRevoked = 'PutRevoked',
  SwapApproved = 'SwapApproved',
  SwapRevoked = 'SwapRevoked',
  NewLiquidityManager = 'NewLiquidityManager',
  RemoveLiquidityManager = 'RemoveLiquidityManager',
  NewInstantSwap = 'NewInstantSwap',
  NewInteractiveSwap = 'NewInteractiveSwap',
  SwapOrderReleased = 'SwapOrderReleased',
  SwapOrderCancelled = 'SwapOrderCancelled',
  SwapOrderPaid = 'SwapOrderPaid',
  NewTicketJoinedMarket = 'NewTicketJoinedMarket',
  TicketLeftMarket = 'TicketLeftMarket',
  TicketSlashed = 'TicketSlashed',
  TicketDrafted = 'TicketDrafted',
  DisputeCreated = 'DisputeCreated',
  FullyDrafted = 'FullyDrafted',
  EvidencePhaseStarted = 'EvidencePhaseStarted',
  EvidencePhaseEnded = 'EvidencePhaseEnded',
  CommitPhaseEnded = 'CommitPhaseEnded',
  RevealPhaseEnded = 'RevealPhaseEnded',
  AppealPhaseEnded = 'AppealPhaseEnded',
  DisputeExecuted = 'DisputeExecuted',
  NewOffer = 'NewOffer',
  OfferUpdated = 'OfferUpdated',
  OfferAccepted = 'OfferAccepted',
  OfferCancelled = 'OfferCancelled',
  OfferUnaccepted = 'OfferUnaccepted',
  OfferExecuted = 'OfferExecuted',
}

@Injectable()
export class NotifierService {
  constructor(@InjectQueue('notifier') private queue: Queue, private cfgSrv: ConfigService) {}

  /**
   * Schedule notification
   * @param notifType The notification type
   * @param network The network where the event occurred
   * @param recipient The address of the recipient
   * @param data The context data
   */
  notify(notifType: NotificationID, network: string, recipient: string, data: { [key: string]: any }) {
    if (this.cfgSrv.get('app.disableNotifications') === 'true') return Promise.resolve();
    return this.queue.add(
      { notifType, recipient, network, data },
      {
        removeOnComplete: true,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }
}

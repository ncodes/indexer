import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { NotifierConsumer } from './NotifierConsumer';
import { isDevMode } from '../../common/common';

export enum NotificationID {
  MediatorInviteReceived = 'MediatorInviteReceived',
  MediatorInviteAccepted = 'MediatorInviteAccepted',
  MediatorRevoked = 'MediatorRevoked',
  PutApproved = 'PutApproved',
  PutRevoked = 'PutRevoked',
  SwapApproved = 'SwapApproved',
  SwapRevoked = 'SwapRevoked',
  UpdatedLiquidityManager = 'UpdatedLiquidityManager',
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
  constructor(
    @InjectQueue('notifier') private queue: Queue,
    private cfgSrv: ConfigService,
    private notifier: NotifierConsumer,
  ) {}

  /**
   * Schedule notification
   * @param notifType The notification type
   * @param network The network where the event occurred
   * @param recipient The address of the recipient
   * @param data The context data
   */
  notify(notifType: NotificationID, network: string, recipient: string, data: { [key: string]: any }) {
    if (this.cfgSrv.get('app.disableNotifications') === 'true') return Promise.resolve();
    if (isDevMode()) return this.notifyNow(notifType, network, recipient, data);
    return this.queue.add(
      {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifType,
        recipient,
        network,
        data,
      },
      {
        removeOnComplete: true,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  /**
   * Send notification without queueing
   * @param notifType The notification type
   * @param network The network where the event occurred
   * @param recipient The address of the recipient
   * @param data The context data
   */
  notifyNow(notifType: NotificationID, network: string, recipient: string, data: any) {
    if (this.cfgSrv.get('app.disableNotifications') === 'true') return Promise.resolve();
    return this.notifier.notify({
      data: {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifType,
        recipient,
        network,
        data,
      },
    } as any);
  }
}

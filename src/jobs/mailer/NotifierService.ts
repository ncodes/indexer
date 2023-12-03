import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { isDev } from '../../common/common';
import { NotifierConsumer } from './NotifierConsumer';

export enum NotificationID {
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
  TicketSlashed = 'TicketSlashed',
  TicketDrafted = 'TicketDrafted',
  DisputeCreated = 'DisputeCreated',
  FullyDrafted = 'FullyDrafted',
  EvidencePhaseStarted = 'EvidencePhaseStarted',
  EvidencePhaseEnded = 'EvidencePhaseEnded',
  CommitPhaseEnded = 'CommitPhaseEnded',
  RevealPhaseEnded = 'RevealPhaseEnded',
  DisputeExecuted = 'DisputeExecuted',
  NewOffer = 'NewOffer',
  OfferUpdated = 'OfferUpdated',
  OfferAccepted = 'OfferAccepted',
  OfferCancelled = 'OfferCancelled',
  OfferUnaccepted = 'OfferUnaccepted',
  OfferExecuted = 'OfferExecuted',
  ChatNewMessage = 'ChatNewMessage',
  VerifyNewEmail = 'VerifyNewEmail',
}

@Injectable()
export class NotifierService {
  disable = false;

  constructor(
    @InjectQueue('notifier') private queue: Queue,
    private cfgSrv: ConfigService,
    private notifier: NotifierConsumer,
  ) {
    this.disable = this.cfgSrv.get('app.disableNotifications') == 'true';
  }

  /**
   * Schedule notification
   * @param notifType The notification type
   * @param network The network where the event occurred
   * @param recipientAddr The address of the recipient
   * @param data The context data
   */
  notify(notifType: NotificationID, network: string, recipientAddr: string, data: { [key: string]: any }) {
    if (this.disable) return Promise.resolve();
    if (isDev()) return this.notifyNow(notifType, network, recipientAddr, data);
    return this.queue.add(
      {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifType,
        recipientAddr,
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
   * @param recipientAddr The address of the recipient
   * @param data The context data
   */
  notifyNow(notifType: NotificationID, network: string, recipientAddr: string, data: any) {
    if (this.disable) return Promise.resolve();
    return this.notifier.notify({
      data: {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifType,
        recipientAddr,
        network,
        data,
      },
    } as any);
  }
}

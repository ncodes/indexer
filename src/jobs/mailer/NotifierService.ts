import { Injectable } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export enum NotifyType {
  MediationInviteReceived,
  MediatorInviteAccepted,
  MediatorRevoked,
  PutApproved,
  PutRevoked,
  SwapApproved,
  SwapRevoked,
  NewLiquidityManager,
  RemoveLiquidityManager,
  NewInstantSwap,
  NewOffChainSwap,
  SwapOrderReleased,
  SwapOrderCancelled,
  SwapOrderPaid,
}

@Injectable()
export class NotifierService {
  constructor(@InjectQueue('notifier') private queue: Queue) {}

  /**
   * Schedule notification
   * @param notifType The notification type
   * @param network The network where the event occurred
   * @param recipient The address of the recipient
   * @param data The context data
   */
  notify(notifType: NotifyType, network: string, recipient: string, data: { [key: string]: any }) {
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

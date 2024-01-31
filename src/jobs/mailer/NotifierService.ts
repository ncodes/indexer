import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { isDev } from '../../common/common';
import { NotifierConsumer } from './NotifierConsumer';
import { NotificationID } from './common';

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
   * @param notifId The notification ID
   * @param network The network where the event occurred
   * @param recipientAddr The address of the recipient
   * @param data The context data
   */
  notify(notifId: NotificationID, network: string, recipientAddr: string, data: { [key: string]: any }) {
    if (this.disable) return Promise.resolve();
    if (isDev()) return this.notifyNow(notifId, network, recipientAddr, data);
    return this.queue.add(
      {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifId,
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
   * @param notifId The notification type
   * @param network The network where the event occurred
   * @param recipientAddr The address of the recipient
   * @param data The context data
   */
  notifyNow(notifId: NotificationID, network: string, recipientAddr: string, data: any) {
    if (this.disable) return Promise.resolve();
    return this.notifier.notify({
      data: {
        appUrl: this.cfgSrv.get('app.appUrl'),
        notifId,
        recipientAddr,
        network,
        data,
      },
    } as any);
  }
}

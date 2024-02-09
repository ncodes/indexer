import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as _ from 'lodash';
import { ConfigService } from '../../../config/config.service';
import Dispute from '../../../models/dispute';
import Draft from '../../../models/draft';
import Reveal from '../../../models/reveal';
import Swap from '../../../models/swap';
import { Base } from '../../base';
import { NotificationService } from '../../notifications/NotificationService';
import { NotificationID } from '../../notifications/common';

/**
 * OnRevealPeriodEnd finds disputes whose reveal period has ended
 */
@Injectable()
export default class OnRevealPeriodEnd extends Base {
  private logger = new Logger(OnRevealPeriodEnd.name);

  constructor(private cfgSrv: ConfigService, private notifier: NotificationService) {
    super();
    this.schedule();
  }

  @Cron('*/5 * * * * *')
  schedule() {
    const disabled = this.cfgSrv.get('app.disableNotifications') == 'true';
    if (!disabled) this.process().catch((e) => this.logger.error(e));
  }

  async process() {
    if (this.isProcessing()) return;
    return new Promise<void>(async (res, rej) => {
      this.setProcessing(true);
      try {
        const disputes = await Dispute.getByAfterRevealEndAt();
        this.logger.debug(`Notifying participants of ${disputes.length} dispute(s)`);
        for (const dispute of disputes) await this.notify(dispute);
        return res();
      } catch (e) {
        this.logger.error(e.message || 'failed to records');
        return rej(e);
      } finally {
        this.setProcessing(false);
      }
    });
  }

  /**
   * Send notifications for the given dispute
   * @param dispute The dispute object
   */
  async notify(dispute: Dispute) {
    const recipients: { address: string; participant?: boolean }[] = [];

    // Get the swap order
    const swap = await Swap.get(dispute.network, dispute.orderId);
    recipients.push({ address: swap.provider, participant: true }, { address: swap.taker, participant: true });

    // Get the drafted tickets
    const drafted = await Draft.getAll(swap.network, swap.marketAddress, swap.orderId, dispute.disputeId);
    recipients.push(
      ..._.map(drafted, (v) => {
        return { address: v.owner };
      }),
    );

    // Compute outcome
    const majority = Math.ceil((51 * dispute.numMediators) / 100);
    const reveals = await Reveal.findByDispute(swap.network, swap.orderId, dispute.disputeId);
    const nRelease = reveals.filter((x) => x.vote === '0x31').length;
    const nCancel = reveals.filter((x) => x.vote === '0x30').length;

    // Send notification
    for (const recipient of recipients) {
      await this.notifier.notify(NotificationID.RevealPhaseEnded, swap.network, recipient.address, {
        swap,
        disputeId: dispute.disputeId,
        numMediators: dispute.numMediators,
        participant: recipient.participant,
        nRelease,
        nCancel,
        majority,
      });
    }

    // Mark dispute row as notified
    await Dispute.updateById(dispute.id, { notifiedOnRevealEndAt: true });
  }
}

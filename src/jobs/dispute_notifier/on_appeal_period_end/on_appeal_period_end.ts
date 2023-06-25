import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Base } from '../../base';
import Dispute from '../../../models/dispute';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import * as _ from 'lodash';
import { NotifierService, NotificationID } from '../../mailer/NotifierService';
import Reveal from '../../../models/reveal';
import * as console from 'console';

/**
 * OnAppealPeriodEnd finds disputes whose appeal period has ended
 */
@Injectable()
export default class OnAppealPeriodEnd extends Base {
  private logger = new Logger(OnAppealPeriodEnd.name);

  constructor(private notifier: NotifierService) {
    super();
    this.schedule();
  }

  @Cron('*/5 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e));
  }

  async process() {
    if (this.isProcessing()) return;
    return new Promise<void>(async (res, rej) => {
      this.setProcessing(true);
      try {
        const disputes = await Dispute.getByAfterAppealEndAt();
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
    const recipients: { address: string; drafted?: boolean }[] = [];

    // Get the swap order
    const swap = await Swap.get(dispute.network, dispute.orderId);
    recipients.push({ address: swap.provider }, { address: swap.taker });

    // Get the drafted tickets
    const drafted = await Draft.getAll(swap.network, swap.marketAddress, swap.orderId, dispute.disputeId);
    recipients.push(
      ..._.map(drafted, (v) => {
        return { address: v.owner, drafted: true };
      }),
    );

    // Compute outcome
    const reveals = await Reveal.findByDispute(swap.network, swap.orderId, dispute.disputeId);
    const majority = Math.ceil((51 * dispute.numMediators) / 100);
    const nRelease = reveals.filter((x) => x.vote === '0x31').length;
    const nCancel = reveals.filter((x) => x.vote === '0x30').length;

    // Send notification. Don't send notification for stalled disputes since re-appeals
    // can be created at any time after the outcome is known
    if (nRelease >= majority || nCancel >= majority) {
      for (const recipient of recipients) {
        await this.notifier.notify(NotificationID.AppealPhaseEnded, swap.network, recipient.address, {
          swap,
          disputeId: dispute.disputeId,
          drafted: recipient.drafted,
        });
      }
    }

    // Mark dispute row as notified
    await Dispute.updateById(dispute.id, { notifiedOnAppealEndAt: true });
  }
}

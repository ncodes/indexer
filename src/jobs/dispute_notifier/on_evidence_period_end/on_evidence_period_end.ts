import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as _ from 'lodash';
import * as moment from 'moment';
import Dispute from '../../../models/dispute';
import Draft from '../../../models/draft';
import Swap from '../../../models/swap';
import { Base } from '../../base';
import { NotificationID, NotifierService } from '../../mailer/NotifierService';

/**
 * OnEvidencePeriodEnd finds disputes whose evidence period has ended
 */
@Injectable()
export default class OnEvidencePeriodEnd extends Base {
  private logger = new Logger(OnEvidencePeriodEnd.name);

  constructor(private notifier: NotifierService, private cfgSrv: ConfigService) {
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
        const disputes = await Dispute.getByAfterEvidenceEndAt();
        this.logger.debug(`Notifying participants of ${disputes.length} dispute(s)`);
        for (const dispute of disputes) await this.notify(dispute);
        return res();
      } catch (e) {
        this.logger.error(e.message || 'failed to get records');
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

    // Get the swap order and add participants as recipients
    const swap = await Swap.get(dispute.network, dispute.orderId);
    recipients.push({ address: swap.provider }, { address: swap.taker });

    // Get the drafted tickets
    const drafted = await Draft.getAll(swap.network, swap.marketAddress, swap.orderId, dispute.disputeId);
    recipients.push(..._.map(drafted, (v) => ({ address: v.owner, drafted: true })));

    // Send notification
    for (const recipient of recipients) {
      await this.notifier.notify(NotificationID.EvidencePhaseEnded, swap.network, recipient.address, {
        swap,
        disputeId: dispute.disputeId,
        commitPhaseHoursLeft: moment(dispute.commitEndAt).fromNow(true),
        drafted: recipient.drafted,
      });
    }

    // Mark dispute row as notified
    await Dispute.updateById(dispute.id, { notifiedOnEvidenceEndAt: true });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Base } from '../../base';
import Dispute from '../../../models/dispute';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import * as _ from 'lodash';
import { NotifierService, NotifyType } from '../../mailer/NotifierService';
import * as moment from 'moment';
import { commify, formatUnits } from 'ethers/lib/utils';
import Reveal from '../../../models/reveal';
import { ConfigService } from '@nestjs/config';

/**
 * OnRevealPeriodEnd finds disputes whose reveal period has ended
 */
@Injectable()
export default class OnRevealPeriodEnd extends Base {
  private logger = new Logger(OnRevealPeriodEnd.name);

  constructor(private cfgSrv: ConfigService, private notifier: NotifierService) {
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
    recipients.push(
      { address: swap.provider, participant: true },
      { address: swap.taker, participant: true },
    );

    // Get the drafted tickets
    const drafted = await Draft.getAll(
      swap.network,
      swap.marketAddress,
      swap.orderId,
      dispute.disputeId,
    );
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
    let outcome = 'Stalled';
    outcome = nRelease >= majority ? 'Release' : outcome;
    outcome = nCancel >= majority ? 'Cancel' : outcome;

    // Send notification
    for (const recipient of recipients) {
      await this.notifier.notify(NotifyType.RevealPhaseEnded, swap.network, recipient.address, {
        marketAddress: swap.marketAddress,
        network: swap.network,
        orderId: swap.orderId,
        disputeId: dispute.disputeId,
        participant: recipient.participant,
        pair: swap.getPair(),
        outcome,
        cost: commify(
          formatUnits(this.cfgSrv.get(`app.contractsParams.${swap.network}.disputeCost`), 18),
        ),
        appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
      });
    }

    // Mark dispute row as notified
    await Dispute.updateById(dispute.id, { notifiedOnRevealEndAt: true });
  }
}

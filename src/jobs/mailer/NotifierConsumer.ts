import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { NotifyType } from './NotifierService';
import { MailerService } from '../../services/mailer.service';
import User from '../../models/user';
import Notification from '../../models/notifications';
import { Logger } from '@nestjs/common';
import { shortenAddr } from '../../common/utils/helpers';
import { AppName } from '../../common/common';

@Processor('notifier')
export class NotifierConsumer {
  logger = new Logger(NotifierConsumer.name);

  constructor(private mailer: MailerService) {}

  /**
   * Process incoming job
   * @param job The job object
   */
  @Process()
  async notify(job: Job<NotifyJob>) {
    switch (job.data.notifType) {
      case NotifyType.MediationInviteReceived:
        return this.notifyMediatorInviteReceived(job.data);
      case NotifyType.MediatorInviteAccepted:
        return this.notifyMediatorInviteAccepted(job.data);
      case NotifyType.MediatorRevoked:
        return this.notifyMediatorRevoked(job.data);
      case NotifyType.PutApproved:
        return this.notifyPutApproved(job.data);
      case NotifyType.PutRevoked:
        return this.notifyPutRevoked(job.data);
      case NotifyType.SwapApproved:
        return this.notifySwapApproved(job.data);
      case NotifyType.SwapRevoked:
        return this.notifySwapRevoked(job.data);
    }
  }

  /**
   * Notify recipient on new mediator invitation
   * @param job The job data
   */
  async notifyMediatorInviteReceived(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const sub = 'Mediation Invitation Received';
    const body = `You have been invited to mediate in a market. If you are interested, open the ${AppName()} app to accept the invitation. <br><br>
<a href="https://fiatx.co/m/${job.data.marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of mediation invitation acceptance
   * @param job The job data
   */
  async notifyMediatorInviteAccepted(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const sub = 'Mediator Accepted Your Invitation';
    const body = `The invited address (${shortenAddr(
      job.data.invitee,
    )}) has accepted your invitation join your market as a mediator.<br><br>
<a href="https://fiatx.co/m/${job.data.marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of mediator revocation
   * @param job The job data
   */
  async notifyMediatorRevoked(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const { marketId } = job.data;
    const sub = 'Mediation Access Revoked';
    const body = `Your mediation access to Market#${shortenAddr(marketId)} has been revoked.<br><br>
<a href="https://fiatx.co/m/${marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of liquidity provisioning approval
   * @param job The job data
   */
  async notifyPutApproved(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const { marketId } = job.data;
    const sub = 'Liquidity Provisioning Access Approved';
    const body = `You have been granted access to provide liquidity to Market#${shortenAddr(
      marketId,
    )}.<br><br>
<a href="https://fiatx.co/m/${marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of liquidity provisioning access revocation
   * @param job The job data
   */
  async notifyPutRevoked(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const { marketId } = job.data;
    const sub = 'Liquidity Provisioning Access Revoked';
    const sm = shortenAddr(marketId);
    const body = `You are no longer permitted to provide liquidity to Market#${sm}. Your access has been revoked.<br><br>
<a href="https://fiatx.co/m/${marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of trade permission grant
   * @param job The job data
   */
  async notifySwapApproved(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const { marketId } = job.data;
    const sub = 'Swap Permission Received';
    const body = `You have been granted permission to carry out swap operations in Market#${shortenAddr(
      marketId,
    )}.<br><br>
<a href="https://fiatx.co/m/${marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }

  /**
   * Notify user of trade permission revocation
   * @param job The job data
   */
  async notifySwapRevoked(job: NotifyJob) {
    // Find user; do nothing if unknown or user has no configured email
    const user = await User.getByAddress(job.recipient);
    if (!user || !user.email) return Promise.resolve();

    // Create notification
    const { marketId } = job.data;
    const sub = 'Swap Permission Revoked';
    const body = `You are no longer permitted to carry out swap operations in Market#${shortenAddr(
      marketId,
    )}. Your access has been revoked.<br><br>
<a href="https://fiatx.co/m/${marketId}">Open Market</a>.`;

    await Notification.create({
      network: job.network,
      userId: user.id,
      title: sub,
      body,
    });

    // Send email
    await this.mailer
      .send('basic', sub, user.email, {
        recipient: shortenAddr(job.recipient),
        title: sub,
        body,
      })
      .catch(this.logger.error);
  }
}

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as moment from 'moment-timezone';
import * as webpush from 'web-push';
import { isEqualStr, shortenAddr, toDec, toTimezone } from '../../common/common';
import Market from '../../models/market';
import Notification, { NotificationType } from '../../models/notification';
import User from '../../models/user';
import WebPushSubscription from '../../models/web_push_subscription';
import { pow10, toFixed } from '../../network/common';
import { MailerService } from '../../services/mailer/mailer.service';
import { canSendNotification } from './common';

/**
 * NotificationConsumer execute notification jobs.
 */
@Processor('notifier')
export class NoticationConsumer {
  logger = new Logger(NoticationConsumer.name);

  constructor(private mailer: MailerService) {}

  /**
   * Process incoming job
   * @param job The job object
   */
  @Process()
  async notify(job: Job<NotifyJob<any>>) {
    let user = job.data.data.user;

    if (!user) {
      user = await User.getByAddress(job.data.recipientAddr);
      if (!user || !user.email) return;
    }

    job.data.user = user;

    // Check if user can receive notifications
    let skipEmail = false;
    if (!canSendNotification(user, job.data.notifId)) {
      this.logger.debug(`User ${user.id} cannot email notification ${job.data.notifId}`);
      skipEmail = true;
    }

    const handler = this[`notify${job.data.notifId}`];
    if (!handler) {
      throw new Error(`No notification handler for ${job.data.notifId}`);
    }

    return this[`notify${job.data.notifId}`](job.data, skipEmail);
  }

  /**
   * Notify user about new swap on their liquidity
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyNewInstantSwap(job: NotifyJob<InstantSwapNotificationData>, skipEmail = false) {
    const { user } = job;
    const { market, swap } = job.data;
    let template;
    let subject: string;
    let note: string;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'New Instant Swap',
      btnValue: 'View Liquidity',
      btnLink: `${job.appUrl}/market/${market.address}/liquidity/${job.recipientAddr}/${swap.lid}`,
    };

    // Check if market is for ERC20/ERC20
    if (Market.isERC20(market.baseType) && Market.isERC20(market.quoteType)) {
      template = `swap-instant/erc20-erc20`;
      const { baseDecimals, quoteDecimals } = market;
      const { amount, price } = swap;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.cost = toFixed(
        toDec(amount)
          .mul(price)
          .div(pow10(baseDecimals + quoteDecimals)),
        8,
      );
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for ERC20/NFT
    if (Market.isERC20(market.baseType) && Market.isNFT(market.quoteType)) {
      template = `swap-instant/erc20-nft`;
      const { baseDecimals } = market;
      const { takerIds, amount } = swap;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.quoteSize = takerIds.length;
      locals.pluralStr = locals.quoteSize > 1 ? 's' : '';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for NFT/ERC20
    if (Market.isNFT(market.baseType) && Market.isERC20(market.quoteType)) {
      template = `swap-instant/nft-erc20`;
      const { quoteDecimals } = market;
      const { providerIds, price } = swap;
      locals.price = toFixed(toDec(price).div(pow10(quoteDecimals)), 8);
      locals.baseSize = providerIds.length;
      locals.pluralStr = locals.baseSize > 1 ? 's' : '';
      locals.wasOrWereStr = locals.baseSize > 1 ? 'were' : 'was';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for NFT/NFT
    if (Market.isNFT(market.baseType) && Market.isNFT(market.quoteType)) {
      template = `swap-instant/nft-nft`;
      const { providerIds, takerIds } = swap;
      locals.baseSize = providerIds.length;
      locals.quoteSize = takerIds.length;
      locals.pluralStr = locals.baseSize > 1 ? 's' : '';
      locals.pluralStrQuote = locals.quoteSize > 1 ? 's' : '';
      locals.wasOrWereStr = locals.baseSize > 1 ? 'were' : 'was';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    await Notification.create({
      type: NotificationType.InstantSwap,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) {
      await this.mailer.send(template, subject, user.email, locals);
    }
  }

  /**
   * Notify user about new interactive swap on their liquidity
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyNewInteractiveSwap(job: NotifyJob<SwapOrderNotificationData>, skipEmail = false) {
    const { user } = job;
    const { market, swap } = job.data;
    let template;
    let subject: string;
    let note: string;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'New Swap Order',
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    // Check if market is for ERC20/SYNTH or SYNTH/ERC20
    if (market.isFungible()) {
      template = `swap-interactive/erc20-synth_synth-erc20`;
      const { baseDecimals, quoteDecimals } = market;
      const { amount, price } = swap;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.cost = toFixed(
        toDec(amount)
          .mul(price)
          .div(pow10(quoteDecimals + baseDecimals)),
        8,
      );
      locals.payer = isEqualStr(swap.getPayer(), job.recipientAddr);
      locals.cancelAt = toTimezone(swap.cancelAt, user.timezone).fromNow(true);
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for SYNTH/NFT
    if (Market.isSynth(market.baseType) && Market.isNFT(market.quoteType)) {
      template = `swap-interactive/synth-nft`;
      const { baseDecimals } = market;
      const { amount } = swap;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.quoteSize = swap.takerIds.length;
      locals.pluralStr = locals.quoteSize > 1 ? 's' : '';
      locals.wasOrWereStr = locals.quoteSize > 1 ? 'were' : 'was';
      locals.cancelAt = toTimezone(swap.cancelAt, user.timezone).fromNow(true);
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for NFT/SYNTH
    if (Market.isNFT(market.baseType) && Market.isSynth(market.quoteType)) {
      template = `swap-interactive/nft-synth`;
      const { quoteDecimals } = market;
      const { price } = swap;
      locals.price = toFixed(toDec(price).div(pow10(quoteDecimals)), 8);
      locals.baseSize = swap.providerIds.length;
      locals.pluralStr = locals.baseSize > 1 ? 's' : '';
      locals.wasOrWereStr = locals.baseSize > 1 ? 'were' : 'was';
      locals.cancelAt = toTimezone(swap.cancelAt, user.timezone).fromNow(true);
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // Check if market is for SYNTH/SYNTH
    if (Market.isSynth(market.baseType) && Market.isSynth(market.quoteType)) {
      template = `swap-interactive/synth-synth`;
      const { baseDecimals, quoteDecimals } = market;
      const { amount, price } = swap;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.cost = toFixed(
        toDec(amount)
          .mul(price)
          .div(pow10(quoteDecimals + baseDecimals)),
        8,
      );
      locals.cancelAt = toTimezone(swap.cancelAt, user.timezone).fromNow(true);
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    await Notification.create({
      type: NotificationType.InteractiveSwap,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about a swap order being cancelled
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifySwapOrderCancelled(job: NotifyJob<CancelledOrderNotification>, skipEmail = false) {
    const { user } = job;
    const { swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Order Cancelled',
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `order/cancelled`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OrderCancellation,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user that a swap order has been marked as paid
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifySwapOrderPaid(job: NotifyJob<OrderPaidNotification>, skipEmail = false) {
    const { user } = job;
    const { swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Order Paid',
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `order/paid`;
    locals.disputeFrom = moment(swap.disputeFrom).fromNow(true);
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OrderPaid,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about swap order being released
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifySwapOrderReleased(job: NotifyJob<OrderReleasedNotification>, skipEmail = false) {
    const { user } = job;
    const { swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Order Released',
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `order/released`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OrderReleased,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of liquidity provisioning approval
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyPutApproved(job: NotifyJob<PutApprovedNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Granted Liquidity Provider Permission',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/put-approved`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.PutApproved,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of liquidity provisioning access revocation
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyPutRevoked(job: NotifyJob<PutRevokedNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Revoked Liquidity Provider Permission',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/put-revoked`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.PutRevoked,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of trade permission grant
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifySwapApproved(job: NotifyJob<SwapApprovedNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Granted Swap Permission',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/swap-approved`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.SwapApproved,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of trade permission revocation
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifySwapRevoked(job: NotifyJob<SwapRevokedNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Revoked Swap Permission',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/swap-revoked`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.SwapRevoked,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about being added as a liquidity manager
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyUpdatedLiquidityManager(job: NotifyJob<UpdatedLiquidityManagerNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      providerShort: shortenAddr(job.data.provider),
      title: 'Granted Liquidity Manager Role',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/new-liq-mgr`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.NewLiqManager,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about being removed as a liquidity manager
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyRemoveLiquidityManager(job: NotifyJob<RemoveLiquidityManagerNotification>, skipEmail = false) {
    const { user } = job;
    const { market } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      providerShort: shortenAddr(job.data.provider),
      title: 'Revoked Liquidity Manager Role',
      btnValue: 'View Market',
      marketLink: `${job.appUrl}/market/${market.address}`,
      btnLink: `${job.appUrl}/market/${market.address}`,
      marketAddressShort: shortenAddr(job.data.market.address),
    };

    const template = `market/rm-liq-mgr`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.RemovedLiqManager,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of new dispute created
   * @param job
   * @param skipEmail Whether to skip sending email
   */
  async notifyDisputeCreated(job: NotifyJob<DisputeCreatedNotification>, skipEmail = false) {
    const { user } = job;
    const { dispute, swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: !dispute.redispute ? 'Order Disputed' : `Order Was Redisputed`,
      btnValue: 'View Order',
      creatorShort: shortenAddr(dispute.creator),
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `dispute/dispute-created`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.DisputeCreated,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify ticket owner of a ticket on new draft event
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyTicketDrafted(job: NotifyJob<TicketDraftedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { dispute } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Ticket Was Drafted',
      btnValue: 'View Order',
      numDrafted: dispute.numMediatorsDrafted,
      orderLink: `${job.appUrl}/swap/${dispute.orderId}`,
      btnLink: `${job.appUrl}/swap/${dispute.orderId}`,
    };

    const template = `dispute/ticket-drafted`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.DisputeTicketDrafted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify order participants about a fully drafted dispute
   * @param job
   */
  async notifyFullyDrafted(job: NotifyJob<FullyDraftedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { dispute } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Evidence Submission Phase',
      btnValue: 'View Order',
      numDrafted: dispute.numMediatorsDrafted,
      orderLink: `${job.appUrl}/swap/${dispute.orderId}`,
      btnLink: `${job.appUrl}/swap/${dispute.orderId}`,
    };

    const template = `dispute/mediators-drafted`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.DisputeEvidenceSubmission,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify drafted mediators that the evidence phase has started
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyEvidencePhaseStarted(job: NotifyJob<FullyDraftedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { dispute } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Evidence Request and Review',
      btnValue: 'View Order',
      orderLink: `${job.appUrl}/swap/${dispute.orderId}`,
      btnLink: `${job.appUrl}/swap/${dispute.orderId}`,
    };

    const template = `dispute/evidence-phase-started`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.EvidencePhaseStarted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify ticket owner of a ticket slash event
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyTicketSlashed(job: NotifyJob<TicketSlashedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { voted } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Ticket Was Slashed',
      reason: !voted ? 'not voting' : 'wrongful voting',
      explain: !voted ? 'You did not vote or complete the voting process' : 'You voted with the minority side',
      ticketManageLink: `${job.appUrl}/mediation/tickets`,
      btnValue: 'Manage Tickets',
      btnLink: `${job.appUrl}/mediation/tickets`,
    };

    const template = `dispute/ticket-slashed`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.DisputeTicketSlashed,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify order dispute participants of the end of the evidence phase
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyEvidencePhaseEnded(job: NotifyJob<EvidencePeriodEndedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Vote Commit Phase Begins',
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `dispute/evidence-phase-ended`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.EvidencePhaseEnded,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify order dispute participants of the end of the commit phase
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyCommitPhaseEnded(job: NotifyJob<CommitPhaseEndedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { swap } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Vote Reveal Phase Begins',
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `dispute/commit-phase-ended`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.CommitPhaseEnded,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify order dispute participants of end of reveal phase
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyRevealPhaseEnded(job: NotifyJob<RevealPhaseEndedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { swap, nRelease, numMediators, nCancel, majority } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      asset: 'JOIN',
      title: 'Dispute Outcome',
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
      pluralStr: numMediators > 1 ? 's' : '',
      pluralWhereWasStr: numMediators > 1 ? 'were' : 'was',
    };

    const template = `dispute/reveal-phase-ended`;
    locals.outcome = 'Stalled';
    locals.outcome = nRelease >= majority ? 'release' : locals.outcome;
    locals.outcome = nCancel >= majority ? 'cancel' : locals.outcome;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.RevealPhaseEnded,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about dispute outcome execution
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyDisputeExecuted(job: NotifyJob<DisputeExecutedNotification>, skipEmail: boolean) {
    const { user } = job;
    const { swap, dispute } = job.data;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Dispute Result Executed',
      orderLink: `${job.appUrl}/swap/${swap.orderId}`,
      btnValue: 'View Order',
      btnLink: `${job.appUrl}/swap/${swap.orderId}`,
    };

    const template = `dispute/dispute-executed`;
    locals.outcome = dispute.released === null ? 'stalled' : dispute.released ? 'released' : 'cancelled';
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.DisputeExecuted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of a new or updated offer on their liquidity
   * @param job
   */
  async notifyNewUpdatedOffer(job: NotifyJob<NewUpdatedOfferNotification>, skipEmail: boolean) {
    const { user } = job;
    const { liq, offer, market, updated } = job.data;
    let template,
      subject,
      note = '';
    const offersLink = `${job.appUrl}/offer/${offer.offerId}`;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: !updated ? 'New Offer' : 'Offer Was Updated',
      creatorShort: shortenAddr(offer.creator),
      offersLink,
      btnValue: 'View Offers',
      btnLink: offersLink,
    };

    // ERC20/ERC20, ERC20/SYNTH, SYNTH/ERC20, SYNTH/SYNTH
    if (market.isFungible()) {
      template = `offer/new-update/fungible`;
      const { baseDecimals, quoteDecimals } = market;
      const { amount, price } = offer;
      locals.amount = toFixed(toDec(amount).div(pow10(baseDecimals)), 8);
      locals.price = toFixed(toDec(price).div(pow10(quoteDecimals)), 8);
      locals.deadline = toTimezone(offer.deadline, user.timezone).fromNow(true);
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // ERC20/NFT, SYNTH/NFT
    if (Market.isFungible(market.baseType) && Market.isNFT(market.quoteType)) {
      template = `offer/new-update/erc20_synth-nft`;
      const { baseDecimals } = market;
      const { ids } = offer;
      locals.amount = toFixed(toDec(liq.amount).div(pow10(baseDecimals)), 8);
      locals.deadline = toTimezone(offer.deadline, user.timezone).fromNow(true);
      locals.pluralStr = ids.length > 1 ? 's' : '';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // NFT/ERC20, NFT/SYNTH
    if (Market.isNFT(market.baseType) && Market.isFungible(market.quoteType)) {
      template = `offer/new-update/nft-erc20_synth`;
      const { quoteDecimals } = market;
      locals.price = toFixed(toDec(offer.price).div(pow10(quoteDecimals)), 8);
      locals.deadline = toTimezone(offer.deadline, user.timezone).fromNow(true);
      locals.pluralStr = liq.ids.length > 1 ? 's' : '';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    // NFT/NFT
    if (Market.isNFT(market.baseType) && Market.isNFT(market.quoteType)) {
      template = `offer/new-update/nft-nft`;
      locals.deadline = toTimezone(offer.deadline, user.timezone).fromNow(true);
      locals.pluralStr = liq.ids.length > 1 ? 's' : '';
      locals.pluralStr2 = offer.ids.length > 1 ? 's' : '';
      subject = await this.mailer.render(`${template}.subject`, locals);
      note = await this.mailer.render(`${template}.note`, locals);
    }

    await Notification.create({
      type: !updated ? NotificationType.NewOffer : NotificationType.OfferUpdated,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of a new offer
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyNewOffer(job: NotifyJob<NewUpdatedOfferNotification>, skipEmail: boolean) {
    return this.notifyNewUpdatedOffer(job, skipEmail);
  }

  /**
   * Notify user of an updated offer
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyOfferUpdated(job: NotifyJob<NewUpdatedOfferNotification>, skipEmail: boolean) {
    return this.notifyNewOffer(job, skipEmail);
  }

  /**
   * Notify user about offer acceptance
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyOfferAccepted(job: NotifyJob<BaseOfferNotification>, skipEmail: boolean) {
    const { user } = job;
    const { offer, market, liq } = job.data;
    const offersLink = `${job.appUrl}/offer/${offer.offerId}`;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Offer Was Accepted',
      liquidityLink: `${job.appUrl}/market/${market.address}/liquidity/${liq.provider}/${liq.lid}`,
      providerShort: shortenAddr(liq.provider),
      offersLink,
      btnValue: 'View Offers',
      btnLink: offersLink,
    };

    const template = `offer/accepted`;
    locals.execTime = toTimezone(offer.execAt, user.timezone).fromNow(true);
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OfferAccepted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about offer unaccepted
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyOfferUnaccepted(job: NotifyJob<BaseOfferNotification>, skipEmail: boolean) {
    const { user } = job;
    const { market, liq, offer } = job.data;
    const offersLink = `${job.appUrl}/offer/${offer.offerId}`;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Offer Was Rejected',
      liquidityLink: `${job.appUrl}/market/${market.address}/liquidity/${liq.provider}/${liq.lid}`,
      offersLink,
      btnValue: 'View Offers',
      btnLink: offersLink,
    };

    const template = `offer/unaccepted`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OfferUnaccepted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about offer cancellation
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyOfferCancelled(job: NotifyJob<BaseOfferNotification>, skipEmail: boolean) {
    const { user } = job;
    const { market, liq, offer } = job.data;
    const offersLink = `${job.appUrl}/offer/${offer.offerId}`;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Offer Was Withdrawn',
      liquidityLink: `${job.appUrl}/market/${market.address}/liquidity/${liq.provider}/${liq.lid}`,
      offersLink,
      btnValue: 'View Offers',
      btnLink: offersLink,
    };

    const template = `offer/cancelled`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OfferCancelled,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user about offer execution
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyOfferExecuted(job: NotifyJob<BaseOfferNotification>, skipEmail: boolean) {
    const { user } = job;
    const { market, liq, offer } = job.data;
    const offersLink = `${job.appUrl}/offer/${offer.offerId}`;
    const locals: any = {
      ...job,
      ...job.data,
      userAddrShort: shortenAddr(job.recipientAddr),
      title: 'Offer Was Executed',
      liquidityLink: `${job.appUrl}/market/${market.address}/liquidity/${liq.provider}/${liq.lid}`,
      offersLink,
      btnValue: 'View Offers',
      btnLink: offersLink,
    };

    const template = `offer/executed`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.OfferExecuted,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
    });

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify a new chat message
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyChatNewMessage(job: NotifyJob<ChatNewMessageNotification>, skipEmail: boolean) {
    const { user } = job;
    const { convo } = job.data;
    const locals = {
      userAddrShort: shortenAddr(user.address),
      isSwap: !!convo.swap,
      orderId: convo.swap?.orderId,
      offerId: convo.swap?.offerId,
      title: 'New Swap Message Interaction',
      btnLink: !!convo.swap
        ? `${job.appUrl}/swap/${convo.swap?.orderId}`
        : `${job.appUrl}/offer/${convo.offer?.offerId}`,
      btnValue: !!convo.swap ? 'View Swap' : 'View Offer',
    };

    const template = `chat/new-message`;
    const subject = await this.mailer.render(`${template}.subject`, locals);
    const note = await this.mailer.render(`${template}.note`, locals);

    await Notification.create({
      type: NotificationType.ChatNewMessage,
      network: job.network,
      userId: job.user.id,
      title: subject,
      body: note,
      orderId: convo.swap ? convo.swap.orderId : null,
      offerId: convo.offer ? convo.offer.offerId : null,
    });

    const sub = await WebPushSubscription.getByNetworkAndAddress(convo.network, user.address);
    if (sub) {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({
          title: subject,
          body: note.replace(/<\/?a[^>].*>.*?/g, ''),
          network: convo.network,
          orderId: convo.orderId,
          offerId: convo.offerId,
        }),
      );
    }

    // Send email
    if (!skipEmail) await this.mailer.send(template, subject, user.email, locals);
  }

  /**
   * Notify user of wallet link verification email
   * @param job The job data
   * @param skipEmail Whether to skip sending email
   */
  async notifyVerifyNewEmail(job: NotifyJob<VerifyNewEmailNotification>, skipEmail: boolean) {
    const { user } = job.data;
    const locals = {
      otp: job.data.otp,
      userAddrShort: shortenAddr(user.address),
    };

    const template = `auth/verify-email`;
    const subject = await this.mailer.render(`${template}.subject`, locals);

    // Send email
    if (!skipEmail) this.mailer.send(template, subject, user.emailUnverified, locals);
  }
}

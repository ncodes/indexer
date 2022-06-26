import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { NotifyType } from './NotifierService';
import { MailerService } from '../../services/mailer.service';
import User from '../../models/user';
import Notification from '../../models/notification';
import { Logger } from '@nestjs/common';
import { shortenAddr } from '../../common/utils/helpers';

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
    const user = await User.getByAddress(job.data.recipient);
    if (!user || !user.email) return Promise.resolve();
    job.data.user = user;

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
      case NotifyType.NewLiquidityManager:
        return this.notifyNewLiquidityManager(job.data);
      case NotifyType.RemoveLiquidityManager:
        return this.notifyRemoveLiquidityManager(job.data);
      case NotifyType.NewInstantSwap:
        return this.notifyNewInstantSwap(job.data);
      case NotifyType.NewOffChainSwap:
        return this.notifyOffChainSwap(job.data);
      case NotifyType.SwapOrderReleased:
        return this.notifySwapOrderReleased(job.data);
      case NotifyType.SwapOrderCancelled:
        return this.notifySwapOrderCancelled(job.data);
      case NotifyType.SwapOrderPaid:
        return this.notifySwapOrderPaid(job.data);
      case NotifyType.JoinedMarket:
        return this.notifyMarketCreatorOnJoinedTicket(job.data);
      case NotifyType.LeftMarket:
        return this.notifyMarketCreatorOnLeftTicket(job.data);
      case NotifyType.TicketSlashed:
        return this.notifyTicketOwnerOnTicketSlash(job.data);
      case NotifyType.TicketDrafted:
        return this.notifyTicketOwnerOnDraft(job.data);
    }
  }

  /**
   * Notify recipient on new mediator invitation
   * @param job The job data
   */
  async notifyMediatorInviteReceived(job: NotifyJob) {
    // Create notification
    const sub = 'Mediation Invitation Received';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You have been invited to mediate for this <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a>. Go to the invitation page on the FIATX app to accept the invitation. You may ignore invitation if you are not interested.`,
    });

    // Send email
    await this.mailer.send('mediator-invite', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of mediation invitation acceptance
   * @param job The job data
   */
  async notifyMediatorInviteAccepted(job: NotifyJob) {
    // Create notification
    const sub = 'Mediator Accepted Your Invitation';
    const shortInvitee = shortenAddr(job.data.invitee);
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `An address (${shortInvitee}) you invited to mediate for your market has accepted your invitation.`,
    });

    // Send email
    await this.mailer.send('mediator-invite-accepted', sub, job.user.email, {
      ...job.data,
      invitee: shortInvitee,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of mediator revocation
   * @param job The job data
   */
  async notifyMediatorRevoked(job: NotifyJob) {
    // Create notification
    const sub = 'Mediation Access Revoked';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `Your mediation access to this permissioned <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a> has been revoked by the market creator.`,
    });

    // Send email
    await this.mailer.send('mediator-revoked', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of liquidity provisioning approval
   * @param job The job data
   */
  async notifyPutApproved(job: NotifyJob) {
    // Create notification
    const sub = 'Liquidity Provider Permission Granted';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You have been granted access to provide liquidity to this permissioned <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('put-approved', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of liquidity provisioning access revocation
   * @param job The job data
   */
  async notifyPutRevoked(job: NotifyJob) {
    // Create notification
    const sub = 'Liquidity Provider Permission Revoked';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You are no longer permitted to provide liquidity to this permissioned <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('put-revoked', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of trade permission grant
   * @param job The job data
   */
  async notifySwapApproved(job: NotifyJob) {
    // Create notification
    const sub = 'Swap Permission Granted';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You have been granted permission to carry out swap operations in this permissioned <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a>.`,
    });

    // Send email
    await this.mailer.send('swap-approved', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user of trade permission revocation
   * @param job The job data
   */
  async notifySwapRevoked(job: NotifyJob) {
    // Create notification
    const sub = 'Swap Permission Revoked';
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You are no longer permitted to carry out swap operations in this permissioned <a href="https://app.fiatx.co/market/${job.data.marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('swap-revoked', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about being added as a liquidity manager
   * @param job The job data
   */
  async notifyNewLiquidityManager(job: NotifyJob) {
    // Create notification
    const sub = 'Granted Liquidity Manager Status';
    const { marketId, provider } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You have been selected as the manager of ${provider}'s <a href="https://app.fiatx.co/liquidity/${provider}">liquidity</a> in this permissioned <a href="https://app.fiatx.co/market/${marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('new-liq-mgr', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about being added as a liquidity manager
   * @param job The job data
   */
  async notifyRemoveLiquidityManager(job: NotifyJob) {
    // Create notification
    const sub = 'Revoked Liquidity Manager Status';
    const { marketId, provider } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You have been removed as the manager of ${provider}'s <a href="https://app
.fiatx.co/liquidity/${provider}">liquidity</a> in this
permissioned <a href="https://app.fiatx.co/market/${marketId}">market</a>.`,
    });

    // Send email
    await this.mailer.send('rm-liq-mgr', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about new swap on their liquidity
   * @param job The job data
   */
  async notifyNewInstantSwap(job: NotifyJob) {
    // Create notification
    const { amount, base, quote, cost, provider } = job.data;
    const sub = `New Instant Swap (${base + '/' + quote} - ${amount} ${base} for ${cost} ${quote})`;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `Your <a href="https://app.fiatx.co/liquidity/${provider}">liquidity</a> was purchased in an instant swap.
${amount} ${base} of your liquidity has been swapped for ${cost} ${quote}.`,
    });

    // Send email
    await this.mailer.send('swap-instant', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about new off-chain swap on their liquidity
   * @param job The job data
   */
  async notifyOffChainSwap(job: NotifyJob) {
    // Create notification
    const { orderId, amount, base, quote, cost } = job.data;
    const pair = `${base + '/' + quote}`;
    const sub = `New Swap Order (ID: ${orderId}, ${pair}, ${amount} ${base} for ${cost} ${quote})`;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `You liquidity has received a swap order. ${amount} ${base} of your liquidity has been ordered for ${cost} ${quote}`,
    });

    // Send email
    await this.mailer.send('swap-off-chain', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about swap order being released
   * @param job The job data
   */
  async notifySwapOrderReleased(job: NotifyJob) {
    // Create notification
    const { orderId, amount, base, quote, cost, byDispute } = job.data;
    const pair = `${base + '/' + quote}`;
    const sub = `Swap Order Released (ID: ${orderId}, ${pair}, ${amount} ${base} for ${cost} ${quote})`;
    const byWho = byDispute ? ' by the dispute system' : '';

    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `The swap <a href="https://app.fiatx.co/swap/${orderId}">order</a> has been released${byWho}. ${amount} ${base} has been transferred to your wallet.`,
    });

    // Send email
    await this.mailer.send('swap-released', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user about a swap order being cancelled
   * @param job The job data
   */
  async notifySwapOrderCancelled(job: NotifyJob) {
    // Create notification
    const { orderId, amount, base, quote, cost, byDispute } = job.data;
    const pair = `${base + '/' + quote}`;
    const sub = `Swap Order Cancelled (ID: ${orderId}, ${pair}, ${amount} ${base} for ${cost} ${quote})`;
    const byWho = !byDispute ? 'by the counterparty' : 'by the dispute system';

    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `The swap <a href="https://app.fiatx.co/swap/${orderId}">order</a> has been cancelled ${byWho}. The ordered assets/liquidity has been returned.`,
    });

    // Send email
    await this.mailer.send('swap-cancelled', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify user that a swap order has been marked as paid
   * @param job The job data
   */
  async notifySwapOrderPaid(job: NotifyJob) {
    // Create notification
    const { orderId, amount, base, quote, cost } = job.data;
    const pair = `${base}/${quote}`;
    const sub = `Swap Order Paid (ID: ${orderId}, ${pair}, ${amount} ${base} for ${cost} ${quote})`;

    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `The swap order#${orderId} has been marked as <b>PAID</b>. 
Please carefully verify payment of ${cost} ${quote} and only release the assets when payment is confirmed.`,
    });

    // Send email
    await this.mailer.send('swap-paid', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
      orderId,
      amount,
      cost,
      quote,
    });
  }

  /**
   * Notify user of a new ticket that joined their market
   * @param job The job data
   */
  async notifyMarketCreatorOnJoinedTicket(job: NotifyJob) {
    // Create notification
    const sub = `New Market Mediator`;
    const { marketId, owner } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `A mediator@${shortenAddr(
        owner,
      )} has joined your <a href="https://app.fiatx.co/market/${marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('new-mediator-joined', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      mediator: shortenAddr(owner),
      title: sub,
    });
  }

  /**
   * Notify user of a new ticket that left their market
   * @param job The job data
   */
  async notifyMarketCreatorOnLeftTicket(job: NotifyJob) {
    // Create notification
    const sub = `Market Mediator Left`;
    const { marketId, owner } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `A mediator@${shortenAddr(
        owner,
      )} has joined your <a href="https://app.fiatx.co/market/${marketId}">market</a>`,
    });

    // Send email
    await this.mailer.send('new-mediator-left', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      mediator: shortenAddr(owner),
      title: sub,
    });
  }

  /**
   * Notify ticket owner of a ticket slash event
   * @param job The job data
   */
  async notifyTicketOwnerOnTicketSlash(job: NotifyJob) {
    // Create notification
    const sub = `Mediation Ticket Slashed`;
    const { ticketId, amount, asset, reason, orderId } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `Your ticket#${ticketId} that was drafted to swap order#${orderId} was slashed of ${amount} ${asset} because it
<b>${reason}</b> in a dispute.`,
    });

    // Send email
    await this.mailer.send('ticket-slashed', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }

  /**
   * Notify ticket owner of a ticket on new draft event
   * @param job The job data
   */
  async notifyTicketOwnerOnDraft(job: NotifyJob) {
    // Create notification
    const sub = `Mediation Ticket Drafted`;
    const { ticketId, orderId, marketId } = job.data;
    await Notification.create({
      network: job.network,
      userId: job.user.id,
      title: sub,
      body: `Your ticket#${ticketId} has been drafted to mediate in a new dispute on swap
<a href="https://app.fiatx.co/swap/${orderId}">order#${orderId}</a>
of <a href="https://app.fiatx.co/market/${marketId}">market#${shortenAddr(marketId)}</a>.`,
    });

    // Send email
    await this.mailer.send('ticket-drafted', sub, job.user.email, {
      ...job.data,
      recipient: shortenAddr(job.recipient),
      title: sub,
    });
  }
}

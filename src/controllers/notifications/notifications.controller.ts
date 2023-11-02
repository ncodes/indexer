import { Body, Controller, Get, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { Model } from 'objection';
import * as webpush from 'web-push';
import { isDevMode, sha1 } from '../../common/common';
import { CommonValidationPipeOpt, CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { IsRootAdmin } from '../../guards/is_basic_admin';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import Convo from '../../models/convo';
import Notification from '../../models/notification';
import OnlineStatus from '../../models/online_status';
import User from '../../models/user';
import WebPushSubscription from '../../models/web_push_subscription';
import { RedisService } from '../../services/redis.service';
import { ChatNotificationDTO, ListQueryDTO, MarkReadDTO, WebPushSubscribeDTO } from './dto';

@Controller('v1/notifications')
export class NotificationsController {
  constructor(private notifySrv: NotifierService, private redisSrv: RedisService) {}

  /**
   * @param req The request object
   * @param q The query object
   * @param q.network The network name.
   * @param [q.read] Whether to return read or unread notification
   * @param [q.count] Indicates whether to return count information only
   * @param [q.limit] The number of result to return (optional)
   * @param [q.offset] The query offset (optional)
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get()
  async list(@Req() req: Request, @Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const res = await Notification.getRecent(
      q.net,
      q.type,
      req.user.id,
      q.orderId,
      q.offerId,
      q.read,
      q.count,
      q.limit,
      q.offset,
    );

    if (q.count) {
      return ok().data({ count: res }).build<CountResponse>();
    }

    return ok().data(res).build<Notification[]>();
  }

  /**
   * Mark a notification as `read`
   * @param req The request object
   * @param id The notification ID
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/mark-read')
  async markAsRead(@Req() req: Request, @Body(new ValidationPipe(ValPipeOpt)) q: MarkReadDTO) {
    await Notification.markAsRead(q.net, q.type, req.user.id, q.orderId, q.offerId);
    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Incoming chat message notification
   * @param req The request object
   * @param body The request body
   */
  @UseGuards(IsRootAdmin)
  @Post('/new-message')
  async newChatNotification(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: ChatNotificationDTO,
  ) {
    // Find user by token
    const user = await User.getByToken(body.token);
    if (!user) throw404('user not found');

    // Find the convo; If convo is muted, return immediately
    const convo = await Convo.getByTopic(body.topic, '[swap,offer]');
    if (!convo) throw404('convo not found');
    if (convo.muted) return ok().data({ ok: false }).build();

    // Determine if provider and taker are online
    let isUserOnline = false;
    let isPeerOnline = false;
    const { swap, offer } = convo;
    if (swap) {
      isUserOnline = await OnlineStatus.isOnline(swap.network, user.address, swap.orderId);
      isPeerOnline = await OnlineStatus.isOnline(swap.network, convo.peerAddress, swap.orderId);
    } else if (offer) {
      isUserOnline = await OnlineStatus.isOnline(offer.network, user.address, undefined, offer.offerId);
      isPeerOnline = await OnlineStatus.isOnline(offer.network, convo.peerAddress, undefined, offer.offerId);
    }

    // Assumption: When user is online but peer is not, set recipient to peer
    let recipient: User;
    if (isUserOnline && !isPeerOnline) {
      recipient = await User.getByAddress(convo.peerAddress);
    }

    // Assumption: When peer is online but user is not, set recipient to user
    if (isPeerOnline && !isUserOnline) {
      recipient = user;
    }

    // Make sure the recipient is not locked
    const lockHash = sha1(`lock-recipient-${recipient}-${swap?.orderId}-${offer?.offerId}}`);
    if (await this.redisSrv.exist(lockHash)) return ok().data({ ok: false }).build();

    // Lock the recipient for 15 seconds, effectively ignoring immediate
    // notifications. Since it is impossible to tell which
    // notification represents a text message, delivery or read receipt, we cannot
    // determine if a notification is a message that should result to a
    // notification. To avoid sending notification for read receipts, we lock.
    await this.redisSrv.setWithExpire(lockHash, '1', 15);

    let isOk = false;
    if (recipient) {
      isOk = true;
      await this.notifySrv.notify(NotificationID.ChatNewMessage, convo.network, undefined, {
        user: recipient,
        convo,
      });
    }

    return ok().data({ ok: isOk }).build();
  }

  /**
   * Web push subscription
   * @param req The request object
   * @param body The request body
   */
  @Post('/web-push/subscribe')
  async webPushSubscribe(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: WebPushSubscribeDTO,
  ) {
    await Model.transaction(async (txn) => {
      await WebPushSubscription.deleteByNetworkAndAddress(body.net, body.address, txn);
      await WebPushSubscription.create({
        network: body.net,
        address: body.address,
        subscription: JSON.stringify(body.subscription),
      });
    });

    return ok().data({ ok: true }).build<OKResponse>();
  }

  @Get('try-notif')
  async tryNotif() {
    if (!isDevMode()) return 'disabled';
    const sub = await WebPushSubscription.getByNetworkAndAddress(
      'ethereum',
      '0xB24780438dD4DB52848A3A398B1A8A08223aBd83',
    );
    await webpush.sendNotification(
      JSON.parse(sub.subscription),
      JSON.stringify({ title: 'Hello Kennedy', body: 'You have new message', orderId: 0 }),
    );

    return 'hello';
  }
}

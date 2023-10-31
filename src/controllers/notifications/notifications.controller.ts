import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { Model } from 'objection';
import * as webpush from 'web-push';
import { sha1 } from '../../common/common';
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
import ChatNotificationService from './chat_notification.service';
import {
  ChatNotificationDTO,
  ListQueryDTO,
  SubscribeToConvoDTO,
  UnsubscribeToConvoDTO,
  WebPushSubscribeDTO,
} from './dto';

@Controller('v1/notifications')
export class NotificationsController {
  constructor(
    private chatNotifSrv: ChatNotificationService,
    private notifySrv: NotifierService,
    private redisSrv: RedisService,
  ) {}

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
    const res = await Notification.getRecent(q.net, q.count, req.user.id, q.read, q.limit, q.offset);

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
  @Put(':id/mark-read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const notification = await Notification.getByIDAndUser(id, req.user.id);
    if (!notification) throw404('notification not found');
    await Notification.updateById(notification.id, { read: true });
    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Subscribe to one or more conversation topics.
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/subscribe')
  async subscribeToConvos(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: SubscribeToConvoDTO,
  ) {
    // Get installation IDs
    const installIds: string[] = [];
    if (req.user.deviceTokenEmail) installIds.push(req.user.id);

    // Subscribe to conversation for each installation
    for (const installId of installIds) {
      await this.chatNotifSrv.subscribe(installId, body.topics);
    }

    // Create convo records
    for (const topic of body.topics) {
      const convo = await Convo.getByNetworkAndTopic(body.net, topic);
      if (convo) continue;
      await Convo.create({
        network: body.net,
        orderId: body.orderId,
        offerId: body.offerId,
        topic,
      });
    }

    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Unsubscribe to one or more conversation topics
   * @param req The request object
   * @param body The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/unsubscribe')
  async unsubscribeToConvos(
    @Req() req: Request,
    @Res() res: Response,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: UnsubscribeToConvoDTO,
  ) {
    // Get installation IDs
    const installIds: string[] = [];
    if (req.user.deviceTokenEmail) installIds.push(req.user.id);

    // Subscribe to conversation for each installation
    for (const installId of installIds) {
      await this.chatNotifSrv.unsubscribe(installId, body.topics);
    }

    return ok(res).status(200).data({ ok: true }).build<OKResponse>();
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

    // Find convo
    const convo = await Convo.getByTopic(body.topic, '[swap,offer]');
    if (!convo) throw404('convo not found');

    // Make sure we haven't seen this notification before
    const hash = sha1(body.message);
    if (await this.redisSrv.exist(hash)) return ok().data({ ok: false }).build<OKResponse>();

    // Save hash to redis for 1 minute
    await this.redisSrv.setWithExpire(hash, '1', 60);

    // Make sure the conversation is not locked
    const lockHash = sha1(`lock-${convo.topic}`);
    if (await this.redisSrv.exist(lockHash)) return ok().data({ ok: false }).build<OKResponse>();

    // Lock the convo for 3 seconds, effectively ignoring immediate
    // notifications. Since it is impossible to tell which
    // notification represents a text message, delivery or read receipt, we cannot
    // determine if a notification is a message that should result to a
    // notification. To avoid sending notification for read receipts, we lock.
    await this.redisSrv.setWithExpire(lockHash, '1', 3);

    // Determine if provider and taker are online
    let isProviderOnline = false;
    let isTakerOnline = false;
    let provider, taker: string;
    const { swap, offer } = convo;
    if (swap) {
      isProviderOnline = await OnlineStatus.isOnline(swap.network, swap.provider, swap.orderId);
      isTakerOnline = await OnlineStatus.isOnline(swap.network, swap.taker, swap.orderId);
      provider = swap.provider;
      taker = swap.taker;
    } else if (offer) {
      isProviderOnline = await OnlineStatus.isOnline(offer.network, offer.provider, undefined, offer.offerId);
      isTakerOnline = await OnlineStatus.isOnline(offer.network, offer.creator, undefined, offer.offerId);
      provider = offer.provider;
      taker = offer.creator;
    }

    // When provider is online but taker is not, send notification to taker
    let recipient: User;
    if (isProviderOnline && !isTakerOnline) {
      recipient = await User.getByAddress(taker);
    }

    // When taker is online but provider is not, send notification to provider
    if (isTakerOnline && !isProviderOnline) {
      recipient = await User.getByAddress(provider);
    }

    let isOk = false;
    if (recipient) {
      isOk = true;
      await this.notifySrv.notify(NotificationID.ChatNewMessage, undefined, undefined, {
        user: recipient,
        convo,
      });
    }

    return ok().data({ ok: isOk }).build<OKResponse>();
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

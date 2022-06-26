import { Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { Request } from 'express';
import { isValidNetwork } from '../../network/common';
import { ok, throw404 } from '../../common/responses/responses';
import Notification from '../../models/notification';

@Controller('v1/notifications')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class NotificationsController {
  /**
   * @param req The request object
   * @param network The network name.
   * @param read Whether to return read or unread notification
   * @param count Indicates whether to return count information only
   * @param limit The number of result to return (optional)
   * @param offset The query offset (optional)
   */
  @Get('')
  async list(
    @Req() req: Request,
    @Query('net') network: string,
    @Query('read') read: string,
    @Query('count') count: boolean,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
  ) {
    if (!isValidNetwork(network)) throw404('unknown network');
    const res = await Notification.getRecent(
      network,
      count,
      req.user.id,
      read === undefined ? undefined : read === 'true',
      parseInt(limit),
      parseInt(offset),
    );

    if (count) {
      return ok().data({ count: res }).build<CountResponse>();
    }

    return ok().data(res).build<Notification[]>();
  }

  /**
   * Mark a notification as `read`
   * @param req The request object
   * @param id The notification ID
   */
  @Put(':id/mark-read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const notification = await Notification.getByIDAndUser(id, req.user.id);
    if (!notification) throw404('notification not found');
    await Notification.updateById(notification.id, { read: true });
    return ok().data({ ok: true }).build<OKResponse>();
  }
}

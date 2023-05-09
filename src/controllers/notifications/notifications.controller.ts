import { Controller, Get, Param, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { Request } from 'express';
import { ok, throw404 } from '../../common/responses/responses';
import Notification from '../../models/notification';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';

@Controller('v1/notifications')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class NotificationsController {
  /**
   * @param req The request object
   * @param q The query object
   *  - [network] The network name.
   *  - [read] Whether to return read or unread notification
   *  - [count] Indicates whether to return count information only
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset (optional)
   */
  @Get()
  async list(@Req() req: Request, @Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const res = await Notification.getRecent(
      q.net,
      q.count,
      req.user.id,
      q.read,
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
  @Put(':id/mark-read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const notification = await Notification.getByIDAndUser(id, req.user.id);
    if (!notification) throw404('notification not found');
    await Notification.updateById(notification.id, { read: true });
    return ok().data({ ok: true }).build<OKResponse>();
  }
}

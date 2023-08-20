import { Controller, Get, Param, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import express from 'express';
import { ErrorMessages, ok, throw401, throw404 } from '../../common/responses/responses';
import User from '../../models/user';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import { UserService } from './user.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO } from './dto';

@Controller('v1/users')
export class UsersController {
  constructor(private userSrv: UserService) {}

  /**
   * Get a user by address. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param address The target user address
   * @param q The query object
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get('/:address')
  async get(
    @Req() req: express.Request,
    @Param('address') address: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    if (req.user && req.user.address.toLowerCase() !== address.toLowerCase()) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = await User.getByAddress(address);
      if (!user) throw404(ErrorMessages.UserNotFound);
    }

    await this.userSrv.extendUser(user, q.net);

    if (!req.user) user.desensitize();

    return ok().data(user).build<User>();
  }
}

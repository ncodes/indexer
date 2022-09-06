import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import express from 'express';
import { ErrorMessages, ok, throw401, throw404 } from '../../common/responses/responses';
import User from '../../models/user';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';

@UseGuards(MayBeAuthenticatedGuard)
@UseGuards(MayHaveKeyGuard)
@Controller('v1/users')
export class UsersController {
  /**
   * Get a user by address. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param address The target user address
   */
  @Get('/:address')
  async get(@Req() req: express.Request, @Param('address') address: string) {
    if (req.user && req.user.address.toLowerCase() !== address.toLowerCase()) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = await User.getByAddress(address);
      if (!user) throw404(ErrorMessages.UserNotFound);
      user.desensitize();
    }

    return ok().data(user).build<User>();
  }
}

import { Controller, Get, Param, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import express from 'express';
import { ErrorMessages, ok, throw401, throw404 } from '../../common/responses/responses';
import User from '../../models/user';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import { UserService } from './user.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { GetQueryDTO } from './dto';
import { isEqualStr } from '../../common/common';

@Controller('v1/users')
export class UsersController {
  constructor(private userSrv: UserService) {}

  /**
   * Get a user by address. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param address The target user address
   * @param q The query object
   * @param [q.net] The network name
   * @param [q.no404] Return a zero User object if user was not found
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get('/:address')
  async get(
    @Req() req: express.Request,
    @Param('address') address: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    if (req.user && isEqualStr(req.user.address, address.toLowerCase())) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = await User.getByAddress(address);
      if (!user && !q.no404) throw404(ErrorMessages.UserNotFound);
      if (!user && q.no404)
        return {
          address,
          volume: '0',
          volumeUsd: 0,
          totalSwaps: 0,
          completionRate: 0,
          badges: [],
        };
    }

    await this.userSrv.extendUser(user, q.net);

    if (!req.user) user.desensitize();

    return ok().data(user).build<User>();
  }
}

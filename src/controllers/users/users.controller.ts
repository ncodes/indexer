import { Body, Controller, Get, Param, Put, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import express, { Request } from 'express';
import { ErrorMessages, ok, throw400, throw401, throw404 } from '../../common/responses/responses';
import User from '../../models/user';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { UpdateCountryDTO, UpdateMethodDTO } from './dto';
import { isValidPaymentMethod } from '../../common/payment_methods';
import { getNameList } from 'country-list';
import { transaction } from 'objection';
import Liquidity from '../../models/liquidity';

@Controller('v1/users')
export class UsersController {
  /**
   * Get a user by address. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param address The target user address
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
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

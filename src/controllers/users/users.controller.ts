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

  /**
   * Update payment method
   * @param req - The request object
   * @param body - The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/payment-method')
  async updatePaymentMethod(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: UpdateMethodDTO,
  ) {
    if (body.method !== 'None' && !isValidPaymentMethod(body.method))
      throw400('payment method is invalid');
    await transaction(User, Liquidity, async (User, Liquidity) => {
      body.method = body.method === 'None' ? null : body.method;
      await User.updateById(req.user.id, { paymentMethod: body.method });
      await Liquidity.updateByProvider(req.user.address, { paymentMethod: body.method });
    });
    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Update user country
   * @param req - The request object
   * @param body - The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/country')
  async updateCountry(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: UpdateCountryDTO,
  ) {
    body.country = body.country.toLowerCase();
    if (body.country !== 'none' && getNameList()[body.country] === undefined)
      throw400('country is invalid');
    let code = getNameList()[body.country];
    await transaction(User, Liquidity, async (User, Liquidity) => {
      code = body.country === 'none' ? null : code;
      await User.updateById(req.user.id, { country: code });
      await Liquidity.updateByProvider(req.user.address, { country: code });
    });
    return ok().data({ ok: true }).build<OKResponse>();
  }
}

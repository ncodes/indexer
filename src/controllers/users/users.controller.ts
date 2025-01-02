import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEthereumAddress } from 'class-validator';
import express from 'express';
import { transaction } from 'objection';
import { isEqualStr } from '../../common/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorMessages, ok, throw401, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import Offer from '../../models/offer';
import OnlineStatus from '../../models/online_status';
import PaymentMethod from '../../models/payment_method';
import Swap from '../../models/swap';
import User from '../../models/user';
import NetworkService from '../../network/network.service';
import { GetQueryDTO, LogOnlineStatusDTO, RegisterDeviceDTO } from './dto';
import { UserService } from './user.service';

@Controller('v1/users')
export class UsersController {
  constructor(private userSrv: UserService, private netSrv: NetworkService, private cfgSrv: ConfigService) {}

  /**
   * Get a user by address or user ID. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param addressOrUserId The target user address
   * @param q The query object
   * @param [q.net] The network name
   * @param [q.no404] Return a zero User object if user was not found
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get('/:addressOrUserId')
  async get(
    @Req() req: express.Request,
    @Param('addressOrUserId') addressOrUserId: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    if (req.user && !isEqualStr(req.user.address, addressOrUserId) && !isEqualStr(req.user.id, addressOrUserId)) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = isEthereumAddress(addressOrUserId)
        ? await User.getByAddress(addressOrUserId)
        : await User.getById(addressOrUserId);

      if (!user && !q.no404) throw404(ErrorMessages.UserNotFound);

      if (!user && q.no404) {
        return ok()
          .data({
            address: addressOrUserId,
            volume: '0',
            volumeUsd: 0,
            totalSwaps: 0,
            completionRate: 0,
            badges: [],
          })
          .build<User>();
      }
    }

    await this.userSrv.extendUser(user, q.net);

    if (!req.user) {
      user = user.desensitize();
    }

    return ok().data(user).build<User>();
  }

  /**
   * Update the default payment method of a user
   * @param req The request object
   * @param paymentMethodId The ID of the payment method to set as default
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/payment-method/:paymentMethodId')
  async updateDefaultPaymentMethod(@Req() req: express.Request, @Param('paymentMethodId') paymentMethodId: string) {
    const pm = await PaymentMethod.getById(paymentMethodId);
    if (!pm) throw404('Payment method not found', undefined, 'paymentMethodId');
    await User.updateById(req.user.id, { defaultPaymentMethodId: pm.id });
    return ok().data({ ok: true }).build();
  }

  /**
   * Register a device
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/register-device')
  async registerDevice(@Req() req: express.Request) {
    await this.userSrv.registerDevice(req.user);
    return ok().data({ ok: true }).build();
  }

  /**
   * Unregister a device
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Delete('/unregister-device')
  async unregisterDevice(@Req() req: express.Request, @Body(new ValidationPipe(ValPipeOpt)) body: RegisterDeviceDTO) {
    return ok()
      .data({ success: await this.userSrv.unregisterDevice(req.user, body.type) })
      .build();
  }

  /**
   * Log the online status of a user
   * @param req The request object
   * @param res The response object
   * @param body The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/log-status')
  async logOnlineStatus(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @Body(new ValidationPipe(ValPipeOpt)) body: LogOnlineStatusDTO,
  ) {
    const address = req.user.address;

    // If order ID is provided, make sure the user is involved in the order
    if (body.orderId != undefined) {
      const swap = await Swap.get(body.net, body.orderId, undefined, 'disputes.draftees');
      if (!swap) return ok(res).status(200).data({ ok: false }).build();
      const isInvolved = !Swap.isSwapCounterparty(swap, address) && !Swap.isSwapDraftee(swap, address, true);
      if (isInvolved) return ok(res).status(200).data({ ok: false }).build();
    }

    // If offer ID is provided, make sure the user is involved in the offer
    if (body.offerId != undefined) {
      const offer = await Offer.getByNetworkAndOfferId(body.net, body.offerId);
      if (!offer) return ok(res).status(200).data({ ok: false }).build();
      const isInvolved = offer.isInvolved(address);
      if (!isInvolved) return ok(res).status(200).data({ ok: false }).build();
    }

    await transaction(OnlineStatus, async (OnlineStatus) => {
      await OnlineStatus.delete(body.net, req.user.address, body.orderId, body.offerId);
      await OnlineStatus.create({
        network: body.net,
        address: req.user.address,
        orderId: body.orderId,
        offerId: body.offerId,
      });
    });

    return ok(res).status(201).data({ ok: true }).build();
  }
}

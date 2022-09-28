import { Body, Controller, Get, Put, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { UpdateMethodDTO } from './dto';
import { Request } from 'express';
import { isValidPaymentMethod, PaymentMethods } from '../../common/payment_methods';
import { ok, throw400 } from '../../common/responses/responses';
import User from '../../models/user';

@Controller('v1/payments')
export class PaymentsController {
  /**
   * Update payment method
   * @param req - The request object
   * @param body - The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/method')
  async updatePaymentMethod(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: UpdateMethodDTO,
  ) {
    if (!isValidPaymentMethod(body.method)) throw400('payment method is invalid');
    await User.updateById(req.user.id, { paymentMethod: body.method });
    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Get payment methods
   */
  @Get('/methods')
  getPaymentMethods() {
    return ok().data(PaymentMethods).build();
  }
}

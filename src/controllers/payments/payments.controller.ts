import { paymentMethods } from '@jointlabs/chains-info';
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok } from '../../common/responses/responses';
import { PaymentsService } from './payments.service';
import { GetGrantSigDTO, GetQueryDTO } from './query.dto';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private paymentSrv: PaymentsService) {}

  /**
   * Get payment methods badges on a network
   * @param q The query parameter
   * @param q.net The network name
   */
  @Get('methods')
  async getPaymentMethods(@Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    return ok()
      .data(paymentMethods[q.net] || [])
      .build();
  }

  @Get('methods/grant-signature')
  async getGrantSignature(@Query(new ValidationPipe(ValPipeOpt)) q: GetGrantSigDTO) {
    return ok()
      .data(
        await this.paymentSrv.getPaymentMethodGrantSignature(
          q.net,
          q.badge,
          q.address,
          q.liquidityAddress,
          q.disable ? '0' : '1',
        ),
      )
      .build<GrantSigInfo>();
  }
}

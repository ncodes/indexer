import { paymentMethods } from '@jointlabs/meta';
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
   * @deprecated Remove when before mainnet launch
   */
  @Get('methods')
  async getPaymentMethods(@Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO) {
    return ok()
      .data(paymentMethods[q.net] || [])
      .build();
  }

  /**
   * Get payment method grant signature
   * @param q The query parameter
   * @param q.net The network name
   * @param q.badge The payment method badge
   * @deprecated Remove when before mainnet launch
   */
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

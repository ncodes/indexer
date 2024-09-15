import { PaymentMethodType } from '@jointlabs/meta';
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import PayRouterOrg from '../../models/pay_router_org';
import PaymentMethod from '../../models/payment_method';
import { AddPaymentMethodDTO } from './query.dto';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private configSrv: ConfigService) {}

  /**
   * Add a payment method
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('methods')
  async add(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: AddPaymentMethodDTO,
  ) {
    const user = req.user;

    // Get the org associated with the payment method name
    const orgCreator = this.configSrv.get('app.payRouter.orgCreatorAddress');
    const org = await PayRouterOrg.findByNetworkAndCreatorAndName(body.net, orgCreator, body.name);
    if (!org) throw400('payment method is unsupported');

    const existingPm = await PaymentMethod.findByNetworkAndOrgIdAndUserId(body.net, org.id, user.id);
    if (existingPm) throw400('payment method already exists');

    const data: Partial<PaymentMethod> = {
      orgId: org.id,
      network: body.net,
      type: body.type,
      additionalInfo: body.additionalInfo,
      userId: user.id,
    };

    if (body.type == PaymentMethodType.Bank) {
      data.name = body.name;
      data.bankAccountNumber = body.bankAccountNumber;
      data.bankAccountName = body.bankAccountName;
      data.routingNumber = body.routingNumber;
      data.swiftCode = body.swiftCode;
    }

    if (body.type == PaymentMethodType.Wallet) {
      data.name = body.name;
      data.accountId = body.accountId;
    }

    return ok()
      .data(await PaymentMethod.create(data))
      .build();
  }

  /**
   * Import all payment method to another network
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('import/:to')
  async import(@Req() req: Request, @Param('to') to: string, @Res() res: Response) {
    const user = req.user;
    const methods = await PaymentMethod.getDistintByUser(user.id, to);

    let imported = 0;
    for (const method of methods) {
      // Get the org associated with the payment method name on the new network
      // if no matching org on the new network, skip it
      const orgCreator = this.configSrv.get('app.payRouter.orgCreatorAddress');
      const org = await PayRouterOrg.findByNetworkAndCreatorAndName(to, orgCreator, method.name);
      if (!org) continue;

      // Check whether the user already has the payment method on the new network.
      // If so, skip it
      const existingPm = await PaymentMethod.findByNetworkAndOrgIdAndUserId(to, org.id, user.id);
      if (existingPm) continue;

      await PaymentMethod.create({
        ...method,
        network: to,
        orgId: org.id,
      });

      imported++;
    }

    return ok(res).data({ imported }).status(200).build();
  }

  /**
   * List all payment methods belonging to the authenticated user
   * @param req The request object
   * @param net The network to filter by (optional)
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('methods')
  async list(@Req() req: Request, @Query('net') net: string) {
    const user = req.user;
    const methods = await PaymentMethod.findByUserIdAndNetwork(user.id, net);
    return ok().data(methods).build();
  }
}

import { Body, Controller, Get, Param, Put, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../guards/be_authenticated.guard';
import { HasKeyGuard } from '../guards/has_token.guard';
import { ok, throw404 } from '../common/responses/responses';
import { CommonValidationPipeOpt as ValPipeOpt } from '../common/pipes/common.pipe';
import { UpdateInstructionsDTO } from './dto';
import { InstructionsService } from './instructions.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { SupportedNetworks } from '../network/common';

@Controller('v1/instructions')
export class InstructionsController {
  constructor(private instructSrv: InstructionsService, private cfgSrv: ConfigService) {}

  /**
   * Update an instruction.
   * If the instruction does not exist, it will be created.
   * If marketAddress, provider and lid are not set, the instruction is global.
   * If marketAddress, provider and lid are set, the instruction is for a specific liquidity.
   * @param req The request object
   * @param body The request body
   * @param body.net The target network
   * @param body.content The instruction content
   * @param [body.marketAddress] The market address (if set, provider and lid must be set)
   * @param [body.provider] The provider (if set, marketAddress and lid must be set)
   * @param [body.lid] The liquidity ID (if set, marketAddress and provider must be set)
   */
  @Put('')
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  async update(@Req() req: Request, @Body(new ValidationPipe(ValPipeOpt)) body: UpdateInstructionsDTO) {
    body.net = SupportedNetworks.Ethereum; // TODO: remove

    // Get the current instruction
    const name = `${req.user.address}:${body.net}`;
    const getResp = await this.instructSrv.get(name);

    let hash: string;
    if (!getResp[0]) {
      getResp[0] = { global: '', liquidity: {} };
      if (!body.marketAddress) getResp[0].global = body.content;
      else getResp[0].liquidity[`${body.marketAddress}:${body.provider}:${body.lid}`] = body.content;
      hash = await this.instructSrv.pin(getResp[0], name);
      return ok().data({ hash, instructions: getResp[0] }).build();
    } else {
      if (!body.marketAddress) getResp[0].global = body.content;
      else getResp[0].liquidity[`${body.marketAddress}:${body.provider}:${body.lid}`.toLowerCase()] = body.content;
      hash = await this.instructSrv.pin(getResp[0], name);
    }

    return ok()
      .data({
        hash,
        instructions: getResp[0],
        sigInfo: await this.instructSrv.getGrantSignature(body.net, req.user.address, hash),
      })
      .build();
  }

  /**
   * Get an instruction
   * @param network The target network
   * @param address The target address
   */
  @Get(':net/:address')
  async get(@Param('net') network: string, @Param('address') address: string) {
    const name = `${address}:${network}`;
    const result = await this.instructSrv.get(name);
    if (!result[0]) throw404('instruction not found');
    return ok().data({ instructions: result[0], hash: result[1] }).build();
  }
}

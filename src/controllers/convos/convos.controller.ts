import { Body, Controller, Get, Param, Post, Put, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { transaction } from 'objection';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Convo from '../../models/convo';
import ConvosService from './convos.service';
import { SubscribeToConvoDTO, UnsubscribeToConvoDTO } from './dto';

@Controller('v1/convos')
export class ConvosController {
  constructor(private chatNotifSrv: ConvosService) {}

  /**
   * Get a conversation by topic
   * @param topic The conversation topic
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/:net/:topic')
  async getConvoByTopic(@Req() req: Request, @Param('net') net: string, @Param('topic') topic: string) {
    const convo = await Convo.get(net, req.user.address, topic.replaceAll('_', '/'));
    if (!convo) throw404('convo not found');
    return ok().data(convo).build<Convo>();
  }

  /**
   * Mute or unmute a conversation by topic
   * @param topic The conversation topic
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/:net/:topic/toggle-mute')
  async toggleConvoMute(@Req() req: Request, @Param('net') net: string, @Param('topic') topic: string) {
    const convo = await Convo.get(net, req.user.address, topic.replaceAll('_', '/'));
    if (!convo) throw404('convo not found');
    await Convo.updateById(convo.id, { muted: !convo.muted });
    return ok().data({ muted: !convo.muted }).build<OKResponse>();
  }

  /**
   * Subscribe to one or more conversation topics.
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/subscribe')
  async subscribeToConvos(
    @Req() req: Request,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: SubscribeToConvoDTO,
  ) {
    // Get installation IDs
    const installIds: string[] = [];
    if (req.user.deviceTokenEmail) installIds.push(req.user.id);

    // Subscribe to conversation for each installation
    for (const installId of installIds) {
      await this.chatNotifSrv.subscribe(installId, body.topics);
    }

    // Create convo records
    await transaction(Convo, async (Convo) => {
      for (const topic of body.topics) {
        const convo = await Convo.get(body.net, req.user.address, topic);
        if (convo) continue;
        await Convo.create({
          address: req.user.address,
          network: body.net,
          orderId: body.orderId,
          offerId: body.offerId,
          topic,
        });
      }
    });

    return ok().data({ ok: true }).build<OKResponse>();
  }

  /**
   * Unsubscribe to one or more conversation topics
   * @param req The request object
   * @param body The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/unsubscribe')
  async unsubscribeToConvos(
    @Req() req: Request,
    @Res() res: Response,
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: UnsubscribeToConvoDTO,
  ) {
    // Get installation IDs
    const installIds: string[] = [];
    if (req.user.deviceTokenEmail) installIds.push(req.user.id);

    // Subscribe to conversation for each installation
    for (const installId of installIds) {
      await this.chatNotifSrv.unsubscribe(installId, body.topics);
    }

    return ok(res).status(200).data({ ok: true }).build<OKResponse>();
  }
}

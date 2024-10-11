import { ChainNames, getChainNames } from '@jointlabs/meta';
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import * as moment from 'moment';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw403, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Appeal from '../../models/appeal';
import AppealMessage from '../../models/appeal_message';
import Swap from '../../models/swap';
import { FilesService } from '../files/files.service';
import SwapService from '../swaps/swap.service';
import { CreateDTO, CreateMessageDTO, GetMessagesQueryDTO } from './query.dto';

@Controller('v1/appeals')
export class AppealsController {
  constructor(private fileSrv: FilesService) {}

  /**
   * Create an appeal
   * @param body The appeal data
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/:net')
  async create(@Req() req: Request, @Param('net') net: string, @Body(new ValidationPipe(ValPipeOpt)) body: CreateDTO) {
    if (!getChainNames().includes(net as ChainNames)) throw400('network is unknown', 'net');

    // Get the order
    const order = await Swap.getByNetworkAndOrderId(net, body.orderId);
    if (!order) throw404('order not found', undefined, 'orderId');

    // Check if the order is paid
    if (!order.paid) throw400('order must be marked as paid', undefined, 'orderId');

    // Check if an appeal already exists
    const existing = await Appeal.getByNetworkAndOrderId(net, order.id);
    if (existing) throw400('appeal already exists', undefined, 'orderId');

    // Check if it is time to create an appeal
    if (moment(order.disputeFrom).isAfter(moment())) throw400('order not ready for appeal', undefined, 'orderId');

    // Check if the order is already released
    if (order.released) throw400('order already released', undefined, 'orderId');

    const fileUrls: string[] = [];
    for (const file of body.files ?? []) {
      const exists = await this.fileSrv.cidExists(file);
      if (!exists) throw400(`file not found: ${file}`, undefined, 'files');
      fileUrls.push(await this.fileSrv.getSignedUrl(file));
    }

    // Create the appeal
    const appeal = await Appeal.create({
      ...body,
      network: net,
      creatorId: req.user.id,
      orderId: order.id,
      files: body.files,
      fileUrls,
    });

    return ok().data(appeal).build();
  }

  async isAppealParty(address: string, order: Swap) {
    await SwapService.loadPayRouterRequest(order);
    const isCounterparty = Swap.isSwapCounterparty(order, address);
    const isRouter = Swap.isRouter(order, address);
    return isCounterparty || isRouter;
  }

  /**
   * Get an appeal
   * @param req The request object
   * @param net The network name
   * @param id The appeal ID
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/:id')
  async get(@Req() req: Request, @Param('id') id: string) {
    // Get the appeal
    const appeal = await Appeal.getById(id);
    if (!appeal) throw404('appeal not found', undefined, 'id');

    // Get the order
    const order = await Swap.getById(appeal.orderId, 'payRouterRequest');
    if (!order) throw404('order not found', undefined, 'orderId');

    const isAppealParty = await this.isAppealParty(req.user.address, order);
    if (!isAppealParty) throw403('user is not authorized to access this appeal');

    return ok().data(appeal).build();
  }

  /**
   * Create a message
   * @param req The request object
   * @param body The message data
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/:id/messages')
  async createMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ValidationPipe(ValPipeOpt)) body: CreateMessageDTO,
  ) {
    if ((!body.files || !body.files.length) && !body.text) {
      throw400('text is required', undefined, 'text');
    }

    const fileUrls: string[] = [];
    for (const file of body.files) {
      const exists = await this.fileSrv.cidExists(file);
      if (!exists) throw400(`file not found: ${file}`, undefined, 'files');
      fileUrls.push(await this.fileSrv.getSignedUrl(file));
    }

    const appeal = await Appeal.getById(id, 'order');
    if (!appeal) throw404('appeal not found', undefined, 'id');

    const isAppealParty = await this.isAppealParty(req.user.address, appeal.order);
    if (!isAppealParty) throw403('user is not authorized to perform this action');

    const message = await AppealMessage.create({
      appealId: appeal.id,
      orderId: appeal.orderId,
      creatorId: req.user.id,
      text: body.text,
      files: body.files,
      fileUrls,
    });

    return ok().data(message).build();
  }

  /**
   * Get messages
   * @param req The request object
   * @param id The appeal ID
   * @param limit The limit of messages to fetch (optional)
   * @param creatorId The creator ID (optional)
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/:id/messages')
  async getMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query(new ValidationPipe(ValPipeOpt)) query: GetMessagesQueryDTO,
  ) {
    const appeal = await Appeal.getById(id, 'order');
    if (!appeal) throw404('appeal not found', undefined, 'id');

    const isAppealParty = await this.isAppealParty(req.user.address, appeal.order);
    if (!isAppealParty) throw403('user is not authorized to perform this action');

    const messages = await AppealMessage.findByAppealId(id, query.creatorId, query.limit);

    return ok().data(messages).build();
  }
}

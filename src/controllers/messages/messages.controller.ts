import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
  Query,
  Get,
  Put,
  Param,
  HttpException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { BeAuthenticatedGuard, notPermitted } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { CreateDTO, ListQueryDTO } from './dto';
import Swap from '../../models/swap';
import { ErrorTypes, ok, throw400, throw401, throw404 } from '../../common/responses/responses';
import { Request } from 'express';
import * as _ from 'lodash';
import Message from '../../models/message';
import { transaction } from 'objection';
import { WebSocketService } from './webSocketService';
import SwapsService from '../swaps/swaps.service';

/**
 * MessagesController handles messaging requests
 */
@Controller('v1/messages')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class MessagesController {
  constructor(
    private msgSrv: MessagesService,
    private ws: WebSocketService,
    private swapSrv: SwapsService,
  ) {}

  /**
   * Create a message
   * @param req The request object
   * @param body The body of the message
   */
  @Post()
  async create(@Req() req: Request, @Body(new ValidationPipe(ValPipeOpt)) body: CreateDTO) {
    const resp = this.msgSrv.validate(body.messages);
    if (resp instanceof HttpException) throw resp;

    // Get swap object. Ensure it is not an instant swap
    const swap = await Swap.getById(body.swapId);
    if (!swap) throw404('swap order not found', ErrorTypes.InvalidRequest, 'swapId');
    if (swap.instant) throw400('instant swap not supported', ErrorTypes.InvalidRequest, 'swapId');

    // Get participant's list and ensure the authenticated user is a participant
    const participants = await this.swapSrv.getParticipants(swap);
    if (!participants.includes(req.user.id))
      throw401(`you are not or no longer a participant`, ErrorTypes.Auth, `messages`);

    // Ensure the recipients are also known participants
    const recipients = await this.msgSrv.getRecipients(body.messages);
    const unknowns = _.difference(recipients, participants);
    if (unknowns.length)
      throw401(
        `recipient[${unknowns[0]}] is not or no longer a participant`,
        ErrorTypes.Auth,
        `messages`,
      );

    // Create message
    let i = 0;
    let message;
    await transaction(Message, async (Message) => {
      const recipientsMsgs = [];
      const recipientsId = [];
      const recipientsMsgPubKey = [];
      const recipientsReadStatus = [];
      for (const msg of body.messages) {
        recipientsMsgs.push(msg.message);
        recipientsId.push(recipients[i]);
        recipientsMsgPubKey.push(msg.recipient);
        recipientsReadStatus.push(false);
        i++;
      }
      message = await Message.create({
        network: swap.network,
        marketId: swap.marketId,
        swapId: swap.id,
        orderId: swap.orderId,
        messages: recipientsMsgs,
        fromId: req.user.id,
        recipientsId,
        recipientsMsgPubKey,
        recipientsReadStatus,
      });
    });

    // Emit event to inform connected participants of new message
    this.ws.emit(`msg:new:${swap.id}`, message.id);

    return ok().data(message.toJSON()).build<Message>();
  }

  /**
   * Get a message
   * @param req The request body
   * @param id The message ID
   */
  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const msg = await Message.getById(id);
    if (!msg) throw404('message not found', ErrorTypes.InvalidRequest, 'id');

    const swap = await Swap.getById(msg.swapId);
    if (!swap) throw404('swap order not found', ErrorTypes.InvalidRequest);

    // Make sure authenticated user is a participant
    const participants = await this.swapSrv.getParticipants(swap, true);
    if (!participants.includes(req.user.id)) throw notPermitted.build();

    return ok().data(msg).build<Message>();
  }

  /**
   * Get messages
   * @param req The request object
   * @param body The request body
   */
  @Get()
  async list(@Req() req: Request, @Query(new ValidationPipe(ValPipeOpt)) body: ListQueryDTO) {
    const swap = await Swap.getById(body.swapId);
    if (!swap) throw404('swap order not found', ErrorTypes.InvalidRequest, 'swapId');

    // Make sure authenticated user is a participant
    const participants = await this.swapSrv.getParticipants(swap, true);
    if (!participants.includes(req.user.id)) throw notPermitted.build();

    // Get all messages
    return ok()
      .data((await Message.getBySwapId(swap.id, body.limit, body.before)).reverse())
      .build<Message[]>();
  }

  /**
   * Mark a message sent to the authenticated user as read.
   * @param req The request object
   * @param msgId The message ID
   */
  @Put('/:msgId/mark-read')
  async markAsRead(@Req() req: Request, @Param('msgId') msgId: string) {
    let msg = await Message.getById(msgId);
    if (!msg) throw404('message not found', ErrorTypes.InvalidRequest, 'msgId');

    // Make sure authenticated user is one of the recipients
    const recipientIndex = msg.recipientsId.indexOf(req.user.id);
    if (recipientIndex === -1) throw401('not permitted to perform action', ErrorTypes.Auth);

    // Mark as read
    msg.recipientsReadStatus[recipientIndex] = true;
    msg = await Message.updateById(msg.id, { recipientsReadStatus: msg.recipientsReadStatus });

    return ok().data(msg).build<Message>();
  }
}

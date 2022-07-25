import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ConfigService } from '@nestjs/config';
import { WebSocketService } from './webSocketService';
import SwapsService from '../swaps/swaps.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, ConfigService, WebSocketService, SwapsService],
})
export class MessagesModule {}

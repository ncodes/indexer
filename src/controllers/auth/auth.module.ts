import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ChatNotificationService from '../notifications/chat_notification.service';
import { UserService } from '../users/user.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [ConfigService, UserService, ChatNotificationService],
})
export class AuthModule {}

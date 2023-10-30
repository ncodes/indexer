import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import ChatNotificationService from '../notifications/chat_notification.service';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [NetworkModule, NotifierModule],
  controllers: [UsersController],
  providers: [UserService, MetadataService, RedisService, ChatNotificationService],
})
export class UsersModule {}

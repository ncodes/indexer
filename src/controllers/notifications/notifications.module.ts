import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { RedisModule } from '../../services/redis/redis.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [NotifierModule, RedisModule],
  controllers: [NotificationsController],
  providers: [],
})
export class NotificationsModule {}

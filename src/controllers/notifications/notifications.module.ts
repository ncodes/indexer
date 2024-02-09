import { Module } from '@nestjs/common';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { RedisModule } from '../../services/redis/redis.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [NotificationModule, RedisModule],
  controllers: [NotificationsController],
  providers: [],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { RedisService } from '../../services/redis.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [NotifierModule],
  controllers: [NotificationsController],
  providers: [RedisService],
})
export class NotificationsModule {}

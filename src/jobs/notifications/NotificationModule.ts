import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../services/mailer/mailer.service';
import { NoticationConsumer } from './NotificationConsumer';
import { NotificationService } from './NotificationService';

const providers = [];

if (!['1', 'true'].includes(process.env.DISABLE_NOTIFICATIONS_PROCESSING)) {
  providers.push(NoticationConsumer);
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifier',
    }),
  ],
  providers: [NotificationService, MailerService, ConfigService, ...providers],
  exports: [MailerService, NotificationService],
})
export class NotificationModule {}

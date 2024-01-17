import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../services/mailer/mailer.service';
import { NotifierConsumer } from './NotifierConsumer';
import { NotifierService } from './NotifierService';

const providers = [];

if (!['1', 'true'].includes(process.env.DISABLE_NOTIFICATIONS_PROCESSING)) {
  providers.push(NotifierConsumer);
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifier',
    }),
  ],
  providers: [NotifierService, MailerService, ConfigService, ...providers],
  exports: [MailerService, NotifierService],
})
export class NotifierModule {}

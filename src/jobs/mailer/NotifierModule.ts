import { Module } from '@nestjs/common';
import { NotifierConsumer } from './NotifierConsumer';
import { NotifierService } from './NotifierService';
import { MailerService } from '../../services/mailer/mailer.service';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifier',
    }),
  ],
  providers: [NotifierConsumer, NotifierService, MailerService, ConfigService],
  exports: [MailerService, NotifierService],
})
export class NotifierModule {}

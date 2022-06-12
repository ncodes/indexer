import { Module } from '@nestjs/common';
import { NotifierConsumer } from './NotifierConsumer';
import { NotifierService } from './NotifierService';
import { MailerService } from '../../services/mailer.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifier',
    }),
  ],
  providers: [NotifierConsumer, NotifierService, MailerService],
  exports: [MailerService, NotifierService],
})
export class NotifierModule {}

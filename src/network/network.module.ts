import { Module } from '@nestjs/common';
import NetworkService from './network.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';
import { NotifierService } from '../jobs/mailer/NotifierService';

@Module({
  imports: [NotifierModule],
  providers: [NetworkService],
  exports: [NetworkService, NotifierService],
})
export class NetworkModule {}

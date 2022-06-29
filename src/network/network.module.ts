import { Module } from '@nestjs/common';
import NetworkService from './network.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';

@Module({
  imports: [NotifierModule],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}

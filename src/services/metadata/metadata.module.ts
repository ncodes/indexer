import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import NetworkService from '../../network/network.service';
import { MetadataService } from './metadata.service';
import { NotifierService } from '../../jobs/mailer/NotifierService';

@Module({
  providers: [MetadataService, NetworkService],
})
export class MetadataModule {}

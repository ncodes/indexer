import { Module } from '@nestjs/common';
import { MiscController } from './misc.controller';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NetworkModule } from '../../network/network.module';

@Module({
  imports: [NotifierModule, NetworkModule],
  providers: [MetadataService],
  controllers: [MiscController],
})
export class MiscModule {}

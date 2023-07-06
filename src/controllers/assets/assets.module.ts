import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';

@Module({
  imports: [NotifierModule],
  controllers: [AssetsController],
  providers: [MetadataService, NetworkService],
})
export class AssetsModule {}

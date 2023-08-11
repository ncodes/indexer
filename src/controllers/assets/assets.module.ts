import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { NetworkModule } from '../../network/network.module';

@Module({
  imports: [NotifierModule, NetworkModule],
  controllers: [AssetsController],
  providers: [MetadataService],
})
export class AssetsModule {}

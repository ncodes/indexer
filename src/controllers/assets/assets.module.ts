import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { AssetsController } from './assets.controller';

@Module({
  imports: [NotifierModule, NetworkModule, RedisModule],
  controllers: [AssetsController],
  providers: [MetadataService],
})
export class AssetsModule {}

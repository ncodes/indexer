import { Module } from '@nestjs/common';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { AssetsController } from './assets.controller';

@Module({
  imports: [NotificationModule, NetworkModule, RedisModule],
  controllers: [AssetsController],
  providers: [MetadataService],
})
export class AssetsModule {}

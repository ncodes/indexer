import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { NetworkModule } from '../../network/network.module';
import { ExchangeRateServiceModule } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MiscController } from './misc.controller';

@Module({
  imports: [NotificationModule, NetworkModule, ExchangeRateServiceModule, RedisModule],
  providers: [MetadataService, ConfigService],
  controllers: [MiscController],
})
export class MiscModule {}

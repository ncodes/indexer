import { Module } from '@nestjs/common';
import { AuthService } from '../controllers/auth/auth.service';
import { NotificationModule } from '../jobs/notifications/NotificationModule';
import { ExchangeRateService, ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisModule } from '../services/redis/redis.module';
import NetworkService from './network.service';

@Module({
  imports: [NotificationModule, ExchangeRateServiceModule, RedisModule],
  providers: [NetworkService, MetadataService, ExchangeRateService, AuthService],
  exports: [NetworkService, MetadataService, ExchangeRateService],
})
export class NetworkModule {}

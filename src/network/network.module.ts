import { Module } from '@nestjs/common';
import NetworkService from './network.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';
import { MetadataService } from '../services/metadata/metadata.service';
import { ExchangeRateService, ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { RedisService } from '../services/redis.service';

@Module({
  imports: [NotifierModule, ExchangeRateServiceModule],
  providers: [NetworkService, MetadataService, ExchangeRateService, RedisService],
  exports: [NetworkService, MetadataService, ExchangeRateService],
})
export class NetworkModule {}

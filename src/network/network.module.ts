import { Module } from '@nestjs/common';
import { PointService } from '../controllers/points/point.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';
import { ExchangeRateService, ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisService } from '../services/redis.service';
import NetworkService from './network.service';

@Module({
  imports: [NotifierModule, ExchangeRateServiceModule],
  providers: [NetworkService, MetadataService, ExchangeRateService, RedisService, PointService],
  exports: [NetworkService, MetadataService, ExchangeRateService],
})
export class NetworkModule {}

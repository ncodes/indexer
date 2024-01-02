import { Module } from '@nestjs/common';
import { AuthService } from '../controllers/auth/auth.service';
import { PointService } from '../controllers/points/point.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';
import { ExchangeRateService, ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisService } from '../services/redis.service';
import NetworkService from './network.service';

@Module({
  imports: [NotifierModule, ExchangeRateServiceModule],
  providers: [NetworkService, MetadataService, ExchangeRateService, RedisService, PointService, AuthService],
  exports: [NetworkService, MetadataService, ExchangeRateService],
})
export class NetworkModule {}

import { Module } from '@nestjs/common';
import { MiscController } from './misc.controller';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NetworkModule } from '../../network/network.module';
import { ExchangeRateServiceModule } from '../../services/exchange_rate.service';
import { ConfigService } from '../../config/config.service';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [NotifierModule, NetworkModule, ExchangeRateServiceModule],
  providers: [MetadataService, ConfigService, RedisService],
  controllers: [MiscController],
})
export class MiscModule {}

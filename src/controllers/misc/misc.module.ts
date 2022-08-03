import { Module } from '@nestjs/common';
import { MiscController } from './misc.controller';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NetworkModule } from '../../network/network.module';
import { ExchangeRateServiceModule } from '../../services/exchange_rate.service';
import { PriceServiceModule } from '../../services/price.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NotifierModule,
    ConfigService,
    NetworkModule,
    ExchangeRateServiceModule,
    PriceServiceModule,
  ],
  providers: [MetadataService],
  controllers: [MiscController],
})
export class MiscModule {}

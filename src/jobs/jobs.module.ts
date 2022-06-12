import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import ExchangeRateCacher from './exchange_rate_cacher/exchange_rate_cacher';
import { NotifierModule } from './mailer/NotifierModule';

const jobs = [ExchangeRateCacher];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configSrv: ConfigService) => ({
        redis: configSrv.get('app.redis.url'),
      }),
      inject: [ConfigService],
    }),
    NotifierModule,
    ExchangeRateServiceModule,
  ],
  providers: [ConfigService].concat(jobs as any),
})
export class JobsModule {}

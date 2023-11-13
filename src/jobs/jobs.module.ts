import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import OnCommitPeriodEnd from './dispute_notifier/on_commit_period_end/on_commit_period_end';
import OnEvidencePeriodEnd from './dispute_notifier/on_evidence_period_end/on_evidence_period_end';
import OnRevealPeriodEnd from './dispute_notifier/on_reveal_period_end/on_reveal_period_end';
import ExchangeRateFetcher from './exchange_rate_cacher/exchange_rate_fetcher';
import { NotifierModule } from './mailer/NotifierModule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configSrv: NestConfigService) => ({
        redis: configSrv.get('app.redis.url'),
      }),
      inject: [NestConfigService],
    }),
    NotifierModule,
    ExchangeRateServiceModule,
  ],
  providers: [ConfigService, ExchangeRateFetcher, OnEvidencePeriodEnd, OnCommitPeriodEnd, OnRevealPeriodEnd],
})
export class JobsModule {}

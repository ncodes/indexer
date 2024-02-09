import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import OnCommitPeriodEnd from './dispute_notifications/on_commit_period_end/onCommitPeriodEnd';
import OnEvidencePeriodEnd from './dispute_notifications/on_evidence_period_end/onEvidencePeriodEnd';
import OnRevealPeriodEnd from './dispute_notifications/on_reveal_period_end/onRevealPeriodEnd';
import ExchangeRateFetcher from './exchange_rate_cacher/ExchangeRateFetcher';
import { NotificationModule } from './notifications/NotificationModule';

const providers = [];

if (!['1', 'true'].includes(process.env.DISABLE_DISPUTE_NOTIFIERS)) {
  providers.push(...[OnCommitPeriodEnd, OnEvidencePeriodEnd, OnRevealPeriodEnd]);
}

if (!['1', 'true'].includes(process.env.DISABLE_CURRENCY_RATE_FETCHER)) {
  providers.push(ExchangeRateFetcher);
}

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
    NotificationModule,
    ExchangeRateServiceModule,
  ],
  providers: [ConfigService, ...providers],
})
export class JobsModule {}

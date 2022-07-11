import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import ExchangeRateCacher from './exchange_rate_cacher/exchange_rate_cacher';
import { NotifierModule } from './mailer/NotifierModule';
import OnEvidencePeriodEnd from './dispute_notifier/on_evidence_period_end/on_evidence_period_end';
import OnCommitPeriodEnd from './dispute_notifier/on_commit_period_end/on_commit_period_end';
import OnRevealPeriodEnd from './dispute_notifier/on_reveal_period_end/on_reveal_period_end';
import OnAppealPeriodEnd from './dispute_notifier/on_appeal_period_end/on_appeal_period_end';

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
  providers: [
    ConfigService,
    ExchangeRateCacher,
    OnEvidencePeriodEnd,
    OnCommitPeriodEnd,
    OnEvidencePeriodEnd,
    OnRevealPeriodEnd,
    OnAppealPeriodEnd,
  ],
})
export class JobsModule {}

import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { NotifierModule } from './mailer/NotifierModule';
import OnEvidencePeriodEnd from './dispute_notifier/on_evidence_period_end/on_evidence_period_end';
import OnCommitPeriodEnd from './dispute_notifier/on_commit_period_end/on_commit_period_end';
import OnRevealPeriodEnd from './dispute_notifier/on_reveal_period_end/on_reveal_period_end';
import { ConfigService } from '../config/config.service';

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
  providers: [
    ConfigService,
    // ExchangeRateCacher,
    OnEvidencePeriodEnd,
    OnCommitPeriodEnd,
    OnEvidencePeriodEnd,
    OnRevealPeriodEnd,
  ],
})
export class JobsModule {}

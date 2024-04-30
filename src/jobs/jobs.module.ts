import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { TwitterService } from '../services/twitter.service';
import { RedisService } from './../services/redis/redis.service';
import BattleManager from './battle_manager/BattleManager';
import OnCommitPeriodEnd from './dispute_notifications/on_commit_period_end/onCommitPeriodEnd';
import OnEvidencePeriodEnd from './dispute_notifications/on_evidence_period_end/onEvidencePeriodEnd';
import OnRevealPeriodEnd from './dispute_notifications/on_reveal_period_end/onRevealPeriodEnd';
import ExchangeRateFetcher from './exchange_rate_cacher/ExchangeRateFetcher';
import MentionedTweetFinder from './mentioned_tweet_finder/MentionedTweetFinder';
import { NotificationModule } from './notifications/NotificationModule';
import PointRedenominator from './point_redominator/PointRedenominator';
import ProviderMessagingStatusUpdate from './provider_messaging_status_update/ProviderMessagingStatusUpdate';

const providers: any[] = [ProviderMessagingStatusUpdate];

if (!['1', 'true'].includes(process.env.DISABLE_DISPUTE_NOTIFIERS)) {
  providers.push(...[OnCommitPeriodEnd, OnEvidencePeriodEnd, OnRevealPeriodEnd]);
}

if (!['1', 'true'].includes(process.env.DISABLE_CURRENCY_RATE_FETCHER)) {
  providers.push(ExchangeRateFetcher);
}

if (['1', 'true'].includes(process.env.ENABLE_MENTIONED_TWEET_FINDER)) {
  providers.push(MentionedTweetFinder);
}

if (['1', 'true'].includes(process.env.ENABLE_POINT_REDENOMINATOR)) {
  providers.push(PointRedenominator);
}

if (['1', 'true'].includes(process.env.ENABLE_BATTLE_MANAGER)) {
  providers.push(RedisService, BattleManager);
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
  providers: [ConfigService, TwitterService, ...providers],
})
export class JobsModule {}

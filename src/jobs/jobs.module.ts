import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import { NetworkModule } from '../network/network.module';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { TwitterService } from '../services/twitter.service';
import { RedisService } from './../services/redis/redis.service';
import BattleManager from './battle_manager/BattleManager';
import OnCommitPeriodEnd from './dispute_notifications/on_commit_period_end/onCommitPeriodEnd';
import OnEvidencePeriodEnd from './dispute_notifications/on_evidence_period_end/onEvidencePeriodEnd';
import OnRevealPeriodEnd from './dispute_notifications/on_reveal_period_end/onRevealPeriodEnd';
import ExchangeRateFetcher from './exchange_rate_cacher/ExchangeRateFetcher';
import MarketMetaManager from './market_meta_manager/MarketMetaManager';
import MentionedTweetFinder from './mentioned_tweet_finder/MentionedTweetFinder';
import { NotificationModule } from './notifications/NotificationModule';
import ProviderMessagingStatusUpdate from './provider_messaging_status_update/ProviderMessagingStatusUpdate';
import TapService from '../controllers/airdrop/tap.service';
import CacheService from '../cacher/cache.service';
import TapReminder from './tap_reminer/TapReminder';
import { TGBotModule } from '../controllers/tgbot/tgbot.module';

const providers: any[] = [];
const imports = [
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
];

if (!['1', 'true'].includes(process.env.DISABLE_DISPUTE_NOTIFIERS)) {
  providers.push(...[OnCommitPeriodEnd, OnEvidencePeriodEnd, OnRevealPeriodEnd]);
}

if (!['1', 'true'].includes(process.env.DISABLE_CURRENCY_RATE_FETCHER)) {
  providers.push(ExchangeRateFetcher);
}

if (['1', 'true'].includes(process.env.ENABLE_MENTIONED_TWEET_FINDER)) {
  providers.push(MentionedTweetFinder);
}

if (['1', 'true'].includes(process.env.ENABLE_BATTLE_MANAGER)) {
  providers.push(RedisService, CacheService, TapService, BattleManager);
}

if (['1', 'true'].includes(process.env.ENABLE_MARKET_META_MANAGER)) {
  providers.push(RedisService, MetadataService, MarketMetaManager);
  imports.push(NetworkModule);
}

if (['1', 'true'].includes(process.env.ENABLE_PROVIDER_MSG_STATUS_UPDATE)) {
  providers.push(ProviderMessagingStatusUpdate);
}

if (['1', 'true'].includes(process.env.ENABLE_TAP_REMINDER)) {
  imports.push(TGBotModule);
  providers.push(CacheService, TapReminder);
}

@Module({
  imports,
  providers: [ConfigService, TwitterService, ...providers],
})
export class JobsModule {}

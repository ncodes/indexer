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
import OnCommitPeriodEnd from './dispute_notifications/on_commit_period_end/onCommitPeriodEnd';
import OnEvidencePeriodEnd from './dispute_notifications/on_evidence_period_end/onEvidencePeriodEnd';
import OnRevealPeriodEnd from './dispute_notifications/on_reveal_period_end/onRevealPeriodEnd';
import ExchangeRateFetcher from './exchange_rate_cacher/ExchangeRateFetcher';
import MarketMetaManager from './market_meta_manager/MarketMetaManager';
import { NotificationModule } from './notifications/NotificationModule';
import ProviderMessagingStatusUpdate from './provider_messaging_status_update/ProviderMessagingStatusUpdate';

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

if (['1', 'true'].includes(process.env.ENABLE_MARKET_META_MANAGER)) {
  providers.push(RedisService, MetadataService, MarketMetaManager);
  imports.push(NetworkModule);
}

if (['1', 'true'].includes(process.env.ENABLE_PROVIDER_MSG_STATUS_UPDATE)) {
  providers.push(ProviderMessagingStatusUpdate);
}

@Module({
  imports,
  providers: [ConfigService, TwitterService, ...providers],
})
export class JobsModule {}

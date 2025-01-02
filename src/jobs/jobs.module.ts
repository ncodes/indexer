import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service';
import Envs from '../config/contants';
import { NetworkModule } from '../network/network.module';
import { ExchangeRateServiceModule } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
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

if (!['1', 'true'].includes(Envs.disableDisputeNotifiers)) {
  providers.push(...[OnCommitPeriodEnd, OnEvidencePeriodEnd, OnRevealPeriodEnd]);
}

if (!['1', 'true'].includes(Envs.disableCurrencyRateFetcher)) {
  providers.push(ExchangeRateFetcher);
}

if (['1', 'true'].includes(Envs.enableMarketMetaManager)) {
  providers.push(RedisService, MetadataService, MarketMetaManager);
  imports.push(NetworkModule);
}

if (['1', 'true'].includes(Envs.enableProviderMsgStatusUpdate)) {
  providers.push(ProviderMessagingStatusUpdate);
}

@Module({
  imports,
  providers: [ConfigService, ...providers],
})
export class JobsModule {}

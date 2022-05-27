import { Module } from '@nestjs/common';
import { MarketCoreHandler } from './market_core.handler';
import { WatcherService } from './watcher.service';

@Module({
  providers: [WatcherService, MarketCoreHandler],
})
export class WatcherModule {}

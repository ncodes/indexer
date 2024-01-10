import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MarketService } from './market.service';
import { MarketsController } from './markets.controller';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [MarketsController],
  providers: [MarketService, MetadataService],
})
export class MarketsModule {}

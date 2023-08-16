import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketsController } from './markets.controller';
import { MarketService } from './market.service';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [NetworkModule],
  controllers: [MarketsController],
  providers: [MarketService, MetadataService, RedisService],
})
export class MarketsModule {}

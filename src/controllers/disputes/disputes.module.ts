import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MarketService } from '../markets/market.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [DisputesController],
  providers: [MarketService, MetadataService],
})
export class DisputesModule {}

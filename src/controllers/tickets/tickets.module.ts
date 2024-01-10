import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MarketService } from '../markets/market.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [TicketsController],
  providers: [TicketsService, MetadataService, MarketService, MetadataService],
})
export class TicketsModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MarketService } from '../markets/market.service';
import SwapService from '../swaps/swap.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [LiquidityController],
  providers: [LiquidityService, MarketService, MetadataService, ConfigService, SwapService],
})
export class LiquidityModule {}

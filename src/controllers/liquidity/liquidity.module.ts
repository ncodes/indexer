import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketService } from '../markets/market.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';
import { ConfigService } from '../../config/config.service';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [NetworkModule],
  controllers: [LiquidityController],
  providers: [LiquidityService, MarketService, MetadataService, ConfigService, RedisService],
})
export class LiquidityModule {}

import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { ExchangeRateService, ExchangeRateServiceModule } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { LiquidityService } from '../liquidity/liquidity.service';
import { MarketService } from '../markets/market.service';
import SwapService from './swap.service';
import { SwapsController } from './swaps.controller';

@Module({
  imports: [NetworkModule, RedisModule, ExchangeRateServiceModule],
  controllers: [SwapsController],
  providers: [MarketService, MetadataService, LiquidityService, SwapService, ExchangeRateService],
})
export class SwapsModule {}

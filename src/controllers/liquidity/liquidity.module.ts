import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { PriceService } from '../../services/price.service';
import { MarketsService } from '../markets/markets.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';

@Module({
  imports: [NetworkModule],
  controllers: [LiquidityController],
  providers: [LiquidityService, MarketsService, PriceService, MetadataService],
})
export class LiquidityModule {}

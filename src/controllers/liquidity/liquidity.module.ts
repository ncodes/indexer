import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { PriceServiceModule } from '../../services/price.service';
import { MarketsService } from '../markets/markets.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';

@Module({
  imports: [NetworkModule, PriceServiceModule],
  controllers: [LiquidityController],
  providers: [LiquidityService, MarketsService, MetadataService],
})
export class LiquidityModule {}

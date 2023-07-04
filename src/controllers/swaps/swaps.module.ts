import { Module } from '@nestjs/common';
import { SwapsController } from './swaps.controller';
import { MarketService } from '../markets/market.service';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { LiquidityService } from '../liquidity/liquidity.service';
import SwapService from './swap.service';

@Module({
  imports: [NetworkModule],
  controllers: [SwapsController],
  providers: [MarketService, MetadataService, LiquidityService, SwapService],
})
export class SwapsModule {}

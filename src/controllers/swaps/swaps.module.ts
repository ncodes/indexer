import { Module } from '@nestjs/common';
import { SwapsController } from './swaps.controller';
import { MarketsService } from '../markets/markets.service';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { LiquidityService } from '../liquidity/liquidity.service';
import SwapsService from './swaps.service';

@Module({
  imports: [NetworkModule],
  controllers: [SwapsController],
  providers: [MarketsService, MetadataService, LiquidityService, SwapsService],
})
export class SwapsModule {}

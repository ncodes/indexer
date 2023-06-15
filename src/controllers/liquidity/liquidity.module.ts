import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketsService } from '../markets/markets.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityService } from './liquidity.service';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [NetworkModule],
  controllers: [LiquidityController],
  providers: [LiquidityService, MarketsService, MetadataService, ConfigService],
})
export class LiquidityModule {}

import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from './../../services/metadata.service';
import { PriceService } from './../../services/price.service';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  imports: [NetworkModule],
  controllers: [MarketsController],
  providers: [MarketsService, PriceService, MetadataService],
})
export class MarketsModule {}

import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { PriceServiceModule } from '../../services/price.service';

@Module({
  imports: [NetworkModule, PriceServiceModule],
  controllers: [MarketsController],
  providers: [MarketsService, MetadataService],
})
export class MarketsModule {}

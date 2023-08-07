import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { NetworkModule } from '../../network/network.module';
import { MarketService } from '../markets/market.service';
import { MetadataService } from '../../services/metadata/metadata.service';

@Module({
  imports: [NetworkModule],
  controllers: [DisputesController],
  providers: [MarketService, MetadataService],
})
export class DisputesModule {}

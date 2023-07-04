import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { NetworkModule } from '../../network/network.module';
import { MarketService } from '../markets/market.service';

@Module({
  imports: [NetworkModule],
  controllers: [DisputesController],
  providers: [MarketService],
})
export class DisputesModule {}

import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { NetworkModule } from '../../network/network.module';
import { MarketsService } from '../markets/markets.service';

@Module({
  imports: [NetworkModule],
  controllers: [DisputesController],
  providers: [MarketsService],
})
export class DisputesModule {}

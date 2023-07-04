import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NetworkModule } from '../../network/network.module';
import { MarketService } from '../markets/market.service';

@Module({
  imports: [NetworkModule],
  controllers: [TicketsController],
  providers: [TicketsService, MarketService],
})
export class TicketsModule {}

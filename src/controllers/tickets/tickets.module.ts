import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NetworkModule } from '../../network/network.module';
import { MarketsService } from '../markets/markets.service';

@Module({
  imports: [NetworkModule],
  controllers: [TicketsController],
  providers: [TicketsService, MarketsService],
})
export class TicketsModule {}

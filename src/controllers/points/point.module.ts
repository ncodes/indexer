import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetworkModule } from '../../network/network.module';
import { PointController } from './point.controller';
import { PointService } from './point.service';

@Module({
  imports: [NetworkModule],
  controllers: [PointController],
  providers: [ConfigService, PointService],
})
export class PointModule {}

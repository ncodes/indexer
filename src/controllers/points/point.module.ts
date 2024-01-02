import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetworkModule } from '../../network/network.module';
import { AuthService } from '../auth/auth.service';
import { PointController } from './point.controller';
import { PointService } from './point.service';

@Module({
  imports: [NetworkModule],
  controllers: [PointController],
  providers: [ConfigService, PointService, AuthService],
})
export class PointModule {}

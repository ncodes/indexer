import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { RedisModule } from '../../services/redis/redis.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}

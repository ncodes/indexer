import { Module } from '@nestjs/common';
import { RedisService } from '../services/redis/redis.service';
import CacheService from './cache.service';
import { RedisModule } from '../services/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [CacheService, RedisService],
})
export class CacheModule {}

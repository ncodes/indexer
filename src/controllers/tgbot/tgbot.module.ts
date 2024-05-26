import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TGBotController } from './tgbot.controller';
import { TGBotService } from './tgbot.service';
import CacheService from '../../cacher/cache.service';
import { RedisService } from '../../services/redis/redis.service';
import { RedisModule } from '../../services/redis/redis.module';
import TapService from '../airdrop/tap.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RedisModule, UsersModule],
  controllers: [TGBotController],
  providers: [ConfigService, TGBotService, RedisService, CacheService, TapService],
})
export class TGBotModule {}

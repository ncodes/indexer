import { Module } from '@nestjs/common';
import CacheService from '../../cacher/cache.service';
import DiscordService from '../../services/discord.service';
import { RedisService } from '../../services/redis/redis.service';
import { TwitterService } from '../../services/twitter.service';
import { AirdropController } from './airdrop.controller';
import AirdropService from './airdrop.service';
import TapGateway from './tap.gateway';
import TapService from './tap.service';

@Module({
  imports: [],
  controllers: [AirdropController],
  providers: [TwitterService, DiscordService, AirdropService, TapGateway, RedisService, TapService, CacheService],
})
export class AirdropModule {}

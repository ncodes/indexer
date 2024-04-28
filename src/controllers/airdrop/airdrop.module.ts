import { Module } from '@nestjs/common';
import DiscordService from '../../services/discord.service';
import { RedisService } from '../../services/redis/redis.service';
import { TwitterService } from '../../services/twitter.service';
import { AirdropController } from './airdrop.controller';
import AirdropService from './airdrop.service';
import TapGateway from './tap.gateway';

@Module({
  imports: [],
  controllers: [AirdropController],
  providers: [TwitterService, DiscordService, AirdropService, TapGateway, RedisService],
})
export class AirdropModule {}

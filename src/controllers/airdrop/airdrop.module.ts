import { Module } from '@nestjs/common';
import DiscordService from '../../services/discord.service';
import { TwitterService } from '../../services/twitter.service';
import { AirdropController } from './airdrop.controller';
import AirdropService from './airdrop.service';

@Module({
  imports: [],
  controllers: [AirdropController],
  providers: [TwitterService, DiscordService, AirdropService],
})
export class AirdropModule {}

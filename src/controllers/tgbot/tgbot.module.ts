import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TGBotController } from './tgbot.controller';
import { TGBotService } from './tgbot.service';

@Module({
  imports: [],
  controllers: [TGBotController],
  providers: [ConfigService, TGBotService],
})
export class TGBotModule {}

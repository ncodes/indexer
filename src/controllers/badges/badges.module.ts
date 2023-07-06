import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgeService } from './badge.service';

@Module({
  imports: [],
  controllers: [BadgesController],
  providers: [BadgeService],
})
export class BadgesModule {}

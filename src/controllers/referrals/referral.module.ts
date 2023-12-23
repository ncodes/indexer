import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralController } from './referral.controller';

@Module({
  imports: [],
  controllers: [ReferralController],
  providers: [ConfigService],
})
export class ReferralModule {}

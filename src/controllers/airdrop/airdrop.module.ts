import { Module } from '@nestjs/common';
import { AirdropController } from './airdrop.controller';

@Module({
  imports: [],
  controllers: [AirdropController],
  providers: [],
})
export class AirdropModule {}

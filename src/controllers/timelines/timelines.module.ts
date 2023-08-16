import { Module } from '@nestjs/common';
import { TimelinesController } from './timelines.controller';

@Module({
  controllers: [TimelinesController],
})
export class TimelinesModule {}

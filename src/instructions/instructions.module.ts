import { Module } from '@nestjs/common';
import { NotificationModule } from '../jobs/notifications/NotificationModule';
import { NetworkModule } from '../network/network.module';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

@Module({
  imports: [NetworkModule, NotificationModule],
  controllers: [InstructionsController],
  providers: [InstructionsService],
})
export class InstructionsModule {}

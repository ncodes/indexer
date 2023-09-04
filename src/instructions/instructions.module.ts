import { Module } from '@nestjs/common';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';
import { NetworkModule } from '../network/network.module';
import NetworkService from '../network/network.service';
import { NotifierModule } from '../jobs/mailer/NotifierModule';

@Module({
  imports: [NetworkModule, NotifierModule],
  controllers: [InstructionsController],
  providers: [InstructionsService, NetworkService],
})
export class InstructionsModule {}

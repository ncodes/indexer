import { Module } from '@nestjs/common';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { ConvosController } from './convos.controller';
import ConvosService from './convos.service';

@Module({
  imports: [NotificationModule],
  controllers: [ConvosController],
  providers: [ConvosService],
})
export class ConvosModule {}

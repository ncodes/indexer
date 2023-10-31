import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { ConvosController } from './convos.controller';
import ConvosService from './convos.service';

@Module({
  imports: [NotifierModule],
  controllers: [ConvosController],
  providers: [ConvosService],
})
export class ConvosModule {}

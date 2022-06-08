import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';

@Module({
  providers: [],
  controllers: [ProvidersController],
})
export class ProvidersModule {}

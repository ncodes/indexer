import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { NetworkModule } from '../../network/network.module';

@Module({
  imports: [NetworkModule],
  controllers: [AdminController],
})
export class AdminModule {}

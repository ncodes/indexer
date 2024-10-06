import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { RedisModule } from '../../services/redis/redis.module';
import { FilesService } from '../files/files.service';
import { AppealsController } from './appeals.controller';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [AppealsController],
  providers: [FilesService],
})
export class AppealsModule {}

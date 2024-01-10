import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../../config/config.service';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { NetworkModule } from '../../network/network.module';
import { RedisModule } from '../redis/redis.module';
import { MetadataService } from './metadata.service';

@Module({
  imports: [ConfigModule, NotifierModule, NetworkModule, RedisModule],
  providers: [ConfigService, MetadataService],
})
export class MetadataModule {}

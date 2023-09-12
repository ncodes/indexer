import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { ConfigService } from '../../config/config.service';
import { ConfigModule } from '@nestjs/config';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { RedisService } from '../redis.service';
import { NetworkModule } from '../../network/network.module';

@Module({
  imports: [ConfigModule, NotifierModule, NetworkModule],
  providers: [ConfigService, MetadataService, RedisService],
})
export class MetadataModule {}

import { Module } from '@nestjs/common';
import NetworkService from '../../network/network.service';
import { MetadataService } from './metadata.service';
import { ConfigService } from '../../config/config.service';
import { ConfigModule } from '@nestjs/config';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { RedisService } from '../redis.service';

@Module({
  imports: [ConfigModule, NotifierModule],
  providers: [ConfigService, MetadataService, NetworkService, RedisService],
})
export class MetadataModule {}

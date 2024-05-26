import { Module } from '@nestjs/common';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { NetworkModule } from '../../network/network.module';
import { JointLinkService } from '../../services/joint_link.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import AirdropService from '../airdrop/airdrop.service';
import ConvosService from '../convos/convos.service';
import { UserService } from './user.service';
import { UsersController } from './users.controller';
import CacheService from '../../cacher/cache.service';
import TapService from '../airdrop/tap.service';

@Module({
  imports: [NetworkModule, NotificationModule, RedisModule],
  controllers: [UsersController],
  providers: [UserService, AirdropService, MetadataService, ConvosService, JointLinkService, CacheService, TapService],
  exports: [UserService],
})
export class UsersModule {}

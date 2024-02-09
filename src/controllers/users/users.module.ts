import { Module } from '@nestjs/common';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { NetworkModule } from '../../network/network.module';
import { JointLinkService } from '../../services/joint_link.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import ConvosService from '../convos/convos.service';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [NetworkModule, NotificationModule, RedisModule],
  controllers: [UsersController],
  providers: [UserService, MetadataService, ConvosService, JointLinkService],
})
export class UsersModule {}

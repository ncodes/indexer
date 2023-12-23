import { Module } from '@nestjs/common';
import { NotifierModule } from '../../jobs/mailer/NotifierModule';
import { NetworkModule } from '../../network/network.module';
import { JointLinkService } from '../../services/joint_link.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import ConvosService from '../convos/convos.service';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

@Module({
  imports: [NetworkModule, NotifierModule],
  controllers: [UsersController],
  providers: [UserService, MetadataService, RedisService, ConvosService, JointLinkService],
})
export class UsersModule {}

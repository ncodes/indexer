import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CacheService from '../../cacher/cache.service';
import { NotificationModule } from '../../jobs/notifications/NotificationModule';
import { JointLinkService } from '../../services/joint_link.service';
import { RedisService } from '../../services/redis/redis.service';
import ConvosService from '../convos/convos.service';
import { UserService } from '../users/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [NotificationModule],
  controllers: [AuthController],
  providers: [ConfigService, UserService, ConvosService, JointLinkService, AuthService, RedisService, CacheService],
})
export class AuthModule {}

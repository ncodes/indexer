import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserService } from './user.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NetworkModule } from '../../network/network.module';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [NetworkModule],
  controllers: [UsersController],
  providers: [UserService, MetadataService, RedisService],
})
export class UsersModule {}

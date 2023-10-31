import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ConvosService from '../convos/convos.service';
import { UserService } from '../users/user.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [ConfigService, UserService, ConvosService],
})
export class AuthModule {}

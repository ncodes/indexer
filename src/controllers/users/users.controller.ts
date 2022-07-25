import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import express from 'express';
import { ok } from '../../common/responses/responses';
import User from '../../models/user';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/users')
export class UsersController {
  @Get('/me')
  async me(@Req() req: express.Request) {
    return ok().data(req.user).build<User>();
  }
}

import { Body, Controller, Get, Post, Query, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transaction } from 'objection';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import {
  ErrorMessages,
  ErrorTypes,
  ok,
  throw400,
  throw401,
  throw404,
} from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import User from '../../models/user';
import { AuthDTO, GetAuthorizerDTO } from './dto';
import { makeSession, parseSignature } from './utils';
import { isEmail } from 'class-validator';

/**
 * AuthController handles all authentication functionalities.
 */
@Controller('v1/auth')
export class AuthController {
  constructor(private cfgSrv: ConfigService) {}

  /**
   * Authenticate signature and generate session token
   * @param body The response body
   * @returns
   */
  @Post()
  async auth(
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: AuthDTO,
  ) {
    let sigInfo: SignatureInfo;

    try {
      sigInfo = parseSignature(body.msg, body.sig);
    } catch (error) {
      throw401('signature is invalid or expired', ErrorTypes.Auth, 'sig');
    }

    // Ensure email is valid if provided
    if (sigInfo.email && !isEmail(sigInfo.email)) {
      throw400('email is not valid', ErrorTypes.InvalidRequest, 'email');
    }

    let token: string;
    let user: User;
    await transaction(User, async (User) => {
      user = await User.getByAddress(sigInfo.address);

      if (!user) {
        user = await User.create({
          address: sigInfo.address,
          email: sigInfo.email,
          role: Roles.User,
        });
      } else {
        user = await User.updateById(user.id, {
          email: user.email !== sigInfo.email ? sigInfo.email : user.email,
        });
      }

      // Create session token
      token = await makeSession(
        user,
        body.sig,
        this.cfgSrv.get('auth.jwtExpMin'),
        this.cfgSrv.get('auth.jwtSecret'),
      );
    });

    return ok().data({ token, user }).build();
  }

  /**
   * Get the user that signed a signature
   * @param body The response body
   * @returns
   */
  @Get('/user')
  async getAuthorizer(
    @Query(new ValidationPipe(CommonValidationPipeOpt))
    body: GetAuthorizerDTO,
  ) {
    let sigInfo: SignatureInfo;

    try {
      sigInfo = parseSignature(body.msg, body.sig, true);
    } catch (error) {
      throw401('signature is invalid or expired', ErrorTypes.Auth, 'sig');
    }

    const user = await User.getByAddress(sigInfo.address);
    if (!user) throw404(ErrorMessages.UserNotFound);

    return ok().data(user).build<User>();
  }
}

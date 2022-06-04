import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transaction } from 'objection';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw401 } from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import User from '../../models/user';
import { ErrorTypes } from '../../common/responses/responses';
import { AuthDTO } from './dto';
import { checkSignature, makeSession } from './utils';

/**
 * AuthController handles all authentication functionalities.
 */
@Controller('v1/auth')
export class AuthController {
  constructor(private cfgSrv: ConfigService) {}

  /**
   * Authenticate signature and generate session token
   * @param body
   * @returns
   */
  @Post()
  async auth(
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: AuthDTO,
  ): Promise<string> {
    let recoveredAddress;

    try {
      recoveredAddress = checkSignature(body.msg, body.sig);
    } catch (error) {
      throw401('signature is invalid or expired', ErrorTypes.Auth, 'sig');
    }

    let token: string;
    let user: User;
    await transaction(User, async (User) => {
      user = await User.getByAddress(recoveredAddress);
      if (!user) {
        user = await User.create({
          address: recoveredAddress,
          email: body.email,
          role: Roles.User,
        });
      } else {
        if (!user.email && body.email) {
          user = await User.updateById(user.id, { email: body.email });
        }
      }

      token = await makeSession(
        user,
        body.sig,
        this.cfgSrv.get('auth.jwtExpMin'),
        this.cfgSrv.get('auth.jwtSecret'),
      );
    });

    return ok().data({ token, user }).build();
  }
}

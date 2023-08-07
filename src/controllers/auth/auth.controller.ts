import { Body, Controller, Get, Post, Query, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transaction } from 'objection';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ErrBadSignature, ErrorMessages, ErrorTypes, ok, throw400, throw404 } from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import User from '../../models/user';
import { AuthDTO, GetAuthorizerDTO } from './dto';
import { hasSeenSignature, makeSession, parseWalletSignature } from './utils';
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
   * @param body.msg The message that was signed
   * @param body.sig The signature derived from the message
   * @returns
   */
  @Post('')
  async auth(
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: AuthDTO,
  ) {
    // Make sure signature is unique
    if (await hasSeenSignature(body.sig)) throw ErrBadSignature;

    let sigData: SignatureData;
    try {
      sigData = parseWalletSignature(body.msg, body.sig);
    } catch (error) {
      throw ErrBadSignature;
    }

    // Ensure email is valid if provided
    if (sigData.email && !isEmail(sigData.email)) {
      throw400('email is not valid', ErrorTypes.InvalidRequest, 'email');
    }

    let token: string;
    let user: User;
    await transaction(User, async (User) => {
      user = await User.getByAddress(sigData.address);
      user = !user
        ? await User.create({ address: sigData.address, email: sigData.email, role: Roles.User })
        : await User.updateById(user.id, { email: user.email !== sigData.email ? sigData.email : user.email });
      token = await makeSession(user, body.sig, this.cfgSrv.get('auth.jwtExpMin'), this.cfgSrv.get('auth.jwtSecret'));
    });

    return ok().data({ token, user }).build();
  }

  /**
   * Get the user that signed a signature
   * @param body The response body
   * @param body.msg The message that was signed
   * @param body.sig The signature derived from the message
   * @returns
   */
  @Get('/user')
  async getAuthorizer(
    @Query(new ValidationPipe(CommonValidationPipeOpt))
    body: GetAuthorizerDTO,
  ) {
    let sigInfo: SignatureData;

    try {
      sigInfo = parseWalletSignature(body.msg, body.sig, true);
    } catch (error) {
      throw ErrBadSignature;
    }

    const user = await User.getByAddress(sigInfo.address);
    if (!user) throw404(ErrorMessages.UserNotFound);

    return ok().data(user).build<User>();
  }
}

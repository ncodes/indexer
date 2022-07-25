import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transaction } from 'objection';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw401 } from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import User from '../../models/user';
import { ErrorTypes } from '../../common/responses/responses';
import { AuthDTO } from './dto';
import { checkSignature, makeSession } from './utils';
import { isEmail, isEmpty } from 'class-validator';
import { PublicKey } from 'eciesjs';

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
    let sigInfo: SignatureInfo;

    try {
      sigInfo = checkSignature(body.msg, body.sig);
    } catch (error) {
      throw401('signature is invalid or expired', ErrorTypes.Auth, 'sig');
    }

    // Ensure email is valid if provided
    if (sigInfo.email && !isEmail(sigInfo.email)) {
      throw400('email is not valid', ErrorTypes.InvalidRequest, 'email');
    }

    // Ensure messenger public key was provided
    if (isEmpty(sigInfo.messengerPublicKey?.trim())) {
      throw400('messenger public key is required', ErrorTypes.InvalidRequest, 'messengerPublicKey');
    } else {
      // Ensure messenger public key is valid
      try {
        PublicKey.fromHex(sigInfo.messengerPublicKey);
      } catch (e) {
        throw400(
          'messenger public key is invalid',
          ErrorTypes.InvalidRequest,
          'messengerPublicKey',
        );
      }
    }

    let token: string;
    let user: User;
    await transaction(User, async (User) => {
      user = await User.getByAddress(sigInfo.address);

      if (!user) {
        user = await User.create({
          address: sigInfo.address,
          messengerPublicKey: sigInfo.messengerPublicKey,
          email: sigInfo.email,
          role: Roles.User,
        });
      } else {
        user = await User.updateById(user.id, {
          email: user.email !== sigInfo.email ? sigInfo.email : user.email,
          messengerPublicKey:
            user.messengerPublicKey !== sigInfo.messengerPublicKey
              ? sigInfo.messengerPublicKey
              : user.messengerPublicKey,
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
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { Request } from 'express';
import { transaction } from 'objection';
import { authenticator, totp } from 'otplib';
import { sha1 } from '../../common/common';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ErrBadSignature, ErrorMessages, ErrorTypes, ok, throw400, throw404 } from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import Session from '../../models/session';
import User from '../../models/user';
import { UserService } from '../users/user.service';
import { AuthService } from './auth.service';
import { AuthDTO, GetAuthorizerDTO, VerifyEmailDTO } from './dto';
import { hasSeenSignature, makeSession, parseWalletSignature } from './utils';

/**
 * AuthController handles all authentication functionalities.
 */
@Controller('v1/auth')
export class AuthController {
  constructor(
    private cfgSrv: ConfigService,
    private authSrv: AuthService,
    private userSrv: UserService,
    private notifSrv: NotifierService,
  ) {}

  /**
   * Authenticate signature and generate session token
   * @param body The request body
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
    if (await hasSeenSignature(sha1(body.sig))) throw ErrBadSignature;

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
    let isUserNew = false;
    await transaction(User, async (User) => {
      user = await User.getByAddress(sigData.address);
      isUserNew = !user;

      // Create user if not found, Set email as unverified.
      // If user was found and email is different, update email as unverified.
      if (!user) {
        const otpSecret = authenticator.generateSecret();
        user = await User.create({
          address: sigData.address,
          emailUnverified: sigData.email,
          role: Roles.User,
          otpSecret,
        });
      } else {
        const otpSecret = authenticator.generateSecret();
        user = await User.updateById(user.id, {
          otpSecret: user.otpSecret ?? otpSecret,
          emailUnverified: user.email !== sigData.email ? sigData.email : null,
        });
      }
    });

    // If email is verified, generate session token,
    // otherwise send an OTP to the unverified email
    if (!user.emailUnverified) {
      token = await makeSession(user, body.sig, this.cfgSrv.get('auth.jwtExpMin'), this.cfgSrv.get('auth.jwtSecret'));
    } else {
      const otp = totp.generate(user.otpSecret);
      this.notifSrv.notify(NotificationID.VerifyNewEmail, undefined, undefined, {
        user,
        otp,
      });
    }

    // Register device for notifications
    await this.userSrv.registerDevice(user);

    // Enable referrer state for the user
    await this.userSrv.enableReferrer(isUserNew, body.referrer, user);

    return ok().data({ token, user }).build();
  }

  /**
   * Verify an unverified email address associated with an account.
   * @param body The request body
   * @param body.userId The user ID
   * @param body.otp The OTP code
   */
  @Put('/verify-email')
  async verifyEmail(
    @Body(new ValidationPipe(CommonValidationPipeOpt))
    body: VerifyEmailDTO,
  ) {
    let user = await User.getById(body.userId);
    if (!user) throw404(ErrorMessages.UserNotFound);
    if (!user.emailUnverified) throw400('email is already verified', ErrorTypes.InvalidRequest);

    totp.options = { window: 10 }; // 5 minutes = 30 seconds steps * 10 windows
    if (!totp.verify({ secret: user.otpSecret, token: body.otp })) throw400('invalid otp', ErrorTypes.InvalidRequest);
    totp.resetOptions();

    user = await User.updateById(user.id, { email: user.emailUnverified, emailUnverified: null });
    const token = await makeSession(
      user,
      undefined,
      this.cfgSrv.get('auth.jwtExpMin'),
      this.cfgSrv.get('auth.jwtSecret'),
    );

    return ok().data({ token, user }).build();
  }

  /**
   * Delete current or all sessions
   * @param req The request object
   * @param all If set, deletes all sessions for the user
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Delete('/session')
  async deleteSession(@Req() req: Request, @Query('all') all: string) {
    if (all) await Session.deleteByUserId(req.user.id);
    else await Session.deleteById(req.session.id);
    return ok().data({ deleted: true }).build();
  }

  /**
   * Get the user that signed a signature
   * @param body The request body
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

  /**
   * Check if an address is allowed to use the app
   * @param address The address to check
   */
  @Get('/:address/allowed')
  isAllowed(@Param('address') address: string) {
    return ok()
      .data({ allowed: this.authSrv.isInPrivateAllowlist(address) })
      .build();
  }
}

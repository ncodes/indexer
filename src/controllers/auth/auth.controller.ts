import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { isEmail } from 'class-validator';
import { Request, Response } from 'express';
import { transaction } from 'objection';
import { authenticator, totp } from 'otplib';
import { isEqualStr, sha1 } from '../../common/common';
import { handleAxiosError } from '../../common/errors/http_response_error';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import {
  ErrBadSignature,
  ErrorMessages,
  ErrorTypes,
  ok,
  throw400,
  throw404,
  throw500,
} from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { NotificationID, NotifierService } from '../../jobs/mailer/NotifierService';
import Session from '../../models/session';
import User from '../../models/user';
import { UserService } from '../users/user.service';
import { AuthService } from './auth.service';
import { AuthByDiscordDTO, AuthDTO, GetAuthorizerDTO, VerifyEmailDTO } from './dto';
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
    await this.userSrv.enableReferrerOps(isUserNew, body.refCode, user);

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
  async isAllowed(@Param('address') address: string) {
    const allowed = this.authSrv.isInPrivateAllowlist(address);
    let code = allowed ? 1 : -1;

    if (allowed) {
      const user = await User.getByAddress(address);
      if (!user || !user.discordId) code = -2;
    }

    return ok().data({ code }).build();
  }

  /**
   * Verify a user's discord account
   * @param res The response object
   * @param body The request body
   * @returns
   */
  @Post('/verify-discord')
  async verifyDiscord(@Res() res: Response, @Body(new ValidationPipe(CommonValidationPipeOpt)) body: AuthByDiscordDTO) {
    let user = await User.getByAddress(body.address);

    // Create user if not found
    // Enable referrer state for the user
    if (!user) {
      user = await User.create({ role: Roles.User, address: body.address });
      await this.userSrv.enableReferrerOps(true, body.refCode, user);
    }

    // Get access token
    let authData: { access_token: string };
    try {
      authData = await this.authSrv.getDiscordAccessToken(body.code);
    } catch (error) {
      if (isAxiosError(error)) {
        const axiosErr = handleAxiosError(error);
        throw400((axiosErr.message as any).error_description, ErrorTypes.Auth);
      } else {
        throw500('server error');
      }
    }

    // Get user info
    let getUserResp: any;
    try {
      getUserResp = await this.authSrv.getDiscordAuthedUser(authData.access_token);
    } catch (error) {
      throw500('server error');
    }

    // Get user guilds
    let guildsListResp: any[];
    try {
      guildsListResp = await this.authSrv.getAuthedUserDiscordGuilds(authData.access_token);
    } catch (error) {
      throw500('server error');
    }

    // Find existing user with the same discord ID
    const existingUser = await User.getByDiscordId(getUserResp.username);
    if (existingUser && !isEqualStr(existingUser.address, user.address)) {
      throw400('Discord account is already linked to another user', ErrorTypes.Auth);
    }

    // Find guild with a specific ID
    const guild = guildsListResp.find((guild: { id: any }) => guild.id === this.cfgSrv.get('app.discord.jointGuildId'));
    if (!guild) throw404('Not a member of Joint discord server');

    // Update the user's discord ID
    await User.updateById(user.id, {
      discordId: getUserResp.username,
    });

    return ok(res).status(200).data({ ok: true }).build();
  }
}

/* tslint:disable:max-classes-per-file */
import { IsLocale, IsNotEmpty, IsOptional, IsTimeZone } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

/**
 * AuthDTO represents request body for login request.
 */
export class AuthDTO {
  constructor(init?: Partial<AuthDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('signature is required', 'sig') })
  sig: string;

  @IsNotEmpty({ message: makeValidatorMsg('message is required', 'msg') })
  msg: string;

  @IsOptional()
  refCode: string;

  @IsTimeZone({ message: makeValidatorMsg('timezone is not valid', 'timezone') })
  @IsOptional()
  timezone: string;
}

/**
 * GetAuthorizerDTO represents request body for getAuthorizer request
 */
export class GetAuthorizerDTO {
  constructor(init?: Partial<AuthDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('signature is required', 'sig') })
  sig: string;

  @IsNotEmpty({ message: makeValidatorMsg('message is required', 'msg') })
  msg: string;
}

export class VerifyEmailDTO {
  @IsNotEmpty({ message: makeValidatorMsg('user ID is required', 'userId') })
  userId: string;

  @IsNotEmpty({ message: makeValidatorMsg('otp is required', 'otp') })
  otp: string;
}

export class AuthByDiscordDTO {
  @IsNotEmpty({ message: makeValidatorMsg('discord auth code is required', 'code') })
  code: string;

  @IsNotEmpty({ message: makeValidatorMsg('address is required', 'address') })
  address: string;

  @IsOptional()
  refCode: string;
}

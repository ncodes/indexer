/* tslint:disable:max-classes-per-file */
import { IsNotEmpty } from 'class-validator';
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

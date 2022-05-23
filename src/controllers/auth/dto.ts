/* tslint:disable:max-classes-per-file */
import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

/**
 * AuthDTO represents request body for login request.
 */
export class AuthDTO {
  constructor(init?: Partial<AuthDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({
    message: makeValidatorMsg('signature is required', 'sig'),
  })
  sig: string;

  @IsNotEmpty({
    message: makeValidatorMsg('message is required', 'msg'),
  })
  msg: string;

  @IsEmail(undefined, {
    message: makeValidatorMsg('email is not valid', 'email'),
  })
  @IsOptional()
  email: string;
}

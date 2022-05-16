/* tslint:disable:max-classes-per-file */
import { IsNotEmpty } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

/**
 * LoginDTO represents request body for login request.
 */
export class LoginDTO {
  constructor(init?: Partial<LoginDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({
    message: makeValidatorMsg('email or phone number is required', 'username'),
  })
  username: string;

  @IsNotEmpty({
    message: makeValidatorMsg('password is required', 'password'),
  })
  password: string;
}

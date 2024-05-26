import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, ValidateNested } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

class UserDataDTO {
  constructor(init?: Partial<UserDataDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('id is required', 'initDataUnsafe.user.id') })
  id: number;

  first_name: string;

  last_name: string;

  @IsNotEmpty({ message: makeValidatorMsg('username is required', 'initDataUnsafe.user.username') })
  username: string;

  @IsBoolean({ message: makeValidatorMsg('allows_write_to_pm is required', 'initDataUnsafe.user.allows_write_to_pm') })
  allows_write_to_pm: boolean;
}

class InitDataUnsafeDTO {
  constructor(init?: Partial<InitDataUnsafeDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('auth_date is required', 'initDataUnsafe.auth_date') })
  auth_date: string;

  @IsNotEmpty({ message: makeValidatorMsg('hash is required', 'initDataUnsafe.hash') })
  hash: string;

  @IsNotEmpty({ message: makeValidatorMsg('query_id is required', 'initDataUnsafe.query_id') })
  query_id: string;

  @IsNotEmpty({ message: makeValidatorMsg('user is required', 'initDataUnsafe.user') })
  @ValidateNested()
  @Type(() => UserDataDTO)
  user: UserDataDTO;
}

export class RegisterDTO {
  constructor(init?: Partial<RegisterDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('init data is required', 'initData') })
  initData: string;

  @IsNotEmpty({ message: makeValidatorMsg('unsafe init data is required', 'initDataUnsafe') })
  @ValidateNested()
  @Type(() => InitDataUnsafeDTO)
  initDataUnsafe: InitDataUnsafeDTO;
}

import { getChainNames } from '@jointlabs/chains-info';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { MineTaskType } from '../../models/mine_task';
class UserDataDTO {
  constructor(init?: Partial<UserDataDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('id is required', 'id') })
  id: number;

  @IsNotEmpty({ message: makeValidatorMsg('first_name is required', 'first_name') })
  first_name: string;

  @IsNotEmpty({ message: makeValidatorMsg('last_name is required', 'last_name') })
  last_name: string;

  @IsNotEmpty({ message: makeValidatorMsg('username is required', 'username') })
  username: string;

  @IsBoolean({ message: makeValidatorMsg('allows_write_to_pm is required', 'allows_write_to_pm') })
  allows_write_to_pm: boolean;
}

class InitDataUnsafeDTO {
  constructor(init?: Partial<InitDataUnsafeDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('auth_date is required', 'auth_date') })
  auth_date: string;

  // @IsNotEmpty({ message: makeValidatorMsg('hash is required', 'hash') })
  // hash: string;
  //
  // @IsNotEmpty({ message: makeValidatorMsg('query_id is required', 'query_id') })
  // query_id: string;
  //
  // @Type(() => UserDataDTO)
  // user: UserDataDTO;
}

export class RegisterDTO {
  constructor(init?: Partial<RegisterDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('init data is required', 'initData') })
  initData: string;

  @IsDefined()
  @IsNotEmpty({ message: makeValidatorMsg('init data unsafe is required', 'initDataUnsafe') })
  @ValidateNested()
  @Type(() => InitDataUnsafeDTO)
  initDataUnsafe: InitDataUnsafeDTO;
}

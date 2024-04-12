/* tslint:disable:max-classes-per-file */
import { IsEthereumAddress, IsNotEmpty, ValidateIf } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class CreateLuckyCodeDTO {
  constructor(init?: Partial<CreateLuckyCodeDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('name is required', 'name') })
  name: string;

  @IsEthereumAddress({ message: makeValidatorMsg('owner address is not valid', 'owner') })
  @IsNotEmpty({ message: makeValidatorMsg('owner is required', 'owner') })
  owner: string;

  @IsNotEmpty({ message: makeValidatorMsg('random is required', 'random') })
  random: boolean;

  @ValidateIf((o) => o.random === true)
  @IsNotEmpty({ message: makeValidatorMsg('minimum amount is required', 'minAmount') })
  minAmount: number;

  @IsNotEmpty({ message: makeValidatorMsg('maximum amount is required', 'maxAmount') })
  maxAmount: number;
}

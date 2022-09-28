import { IsNotEmpty } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class UpdateMethodDTO {
  constructor(init?: Partial<UpdateMethodDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('method is required') })
  method: string;
}

export class UpdateCountryDTO {
  constructor(init?: Partial<UpdateCountryDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('country is required') })
  country: string;
}

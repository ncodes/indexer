import { IsNotEmpty } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class UpdateMethodDTO {
  constructor(init?: Partial<UpdateMethodDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('method is required') })
  method: string;
}

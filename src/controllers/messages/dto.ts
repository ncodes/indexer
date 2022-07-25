import { IsNotEmpty, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class CreateDTO {
  @IsNotEmpty({ message: makeValidatorMsg('swap ID is required', 'swapId') })
  swapId: string;

  @IsNotEmpty({ message: makeValidatorMsg('at least one message is required', 'messages') })
  messages: EncryptedMessage[];
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @IsNotEmpty({ message: makeValidatorMsg('swap ID is required', 'swapId') })
  swapId: string;

  @IsOptional()
  before: number;

  @IsOptional()
  limit = 25;
}

// tslint:disable-next-line:max-classes-per-file
export class MarkAsReadDTO {}

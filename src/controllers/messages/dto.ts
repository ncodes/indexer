import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { MessageType } from '../../models/message';

export class CreateDTO {
  @IsEnum(MessageType, { message: makeValidatorMsg('invalid type', 'type') })
  @IsNotEmpty({ message: makeValidatorMsg('type is required', 'type') })
  type: MessageType;

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

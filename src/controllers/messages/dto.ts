import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { MessageType } from '../../models/message';
import { Transform } from 'class-transformer';
import { toNumber } from 'lodash';

export class CreateDTO {
  @IsEnum(MessageType, { message: makeValidatorMsg('invalid type', 'type') })
  @IsNotEmpty({ message: makeValidatorMsg('type is required', 'type') })
  type: MessageType;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  @IsNotEmpty({ message: makeValidatorMsg('order ID is required', 'orderId') })
  orderId: number;

  @IsNotEmpty({ message: makeValidatorMsg('at least one message is required', 'messages') })
  messages: EncryptedMessage[];
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  @IsNotEmpty({ message: makeValidatorMsg('order ID is required', 'orderId') })
  orderId: number;

  @IsOptional()
  before: number;

  @IsOptional()
  limit = 25;
}

// tslint:disable-next-line:max-classes-per-file
export class ListPMQueryDTO {
  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  @IsNotEmpty({ message: makeValidatorMsg('order ID is required', 'orderId') })
  orderId: number;
}

// tslint:disable-next-line:max-classes-per-file
export class MarkAsReadDTO {}

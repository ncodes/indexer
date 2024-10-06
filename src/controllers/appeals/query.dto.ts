import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { toNumber } from 'lodash';
import { makeValidatorMsg } from '../../common/validations/validation';

export class CreateDTO {
  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  public orderId?: number;

  @MaxLength(250, { message: makeValidatorMsg('issue is too long', 'issue') })
  @IsNotEmpty({ message: makeValidatorMsg('issue is required', 'issue') })
  public issue: string;
}

export class CreateMessageDTO {
  @Length(0, 500, { message: makeValidatorMsg('text is too long', 'text') })
  @IsOptional()
  text: string;

  @ArrayMaxSize(4, { message: makeValidatorMsg('maximum of 4 files per message', 'files') })
  @IsArray({ message: makeValidatorMsg('files must be an array', 'files') })
  @IsOptional()
  files: string[] = [];
}

export class GetMessagesQueryDTO {
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  limit?: number;

  @IsOptional()
  @IsString({ message: makeValidatorMsg('must be a string', 'creatorId') })
  creatorId?: string;
}

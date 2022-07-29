import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toBoolean } from 'underscore.string';
import { toNumber } from 'lodash';

export class CreateDTO {
  @MaxLength(256, {
    message: makeValidatorMsg('comment is too long (max: 256 characters)', 'comment'),
  })
  @IsOptional()
  public comment?: string;

  @IsNotEmpty({ message: makeValidatorMsg('set to true or false', 'satisfied') })
  satisfied: boolean;
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'count') })
  @IsOptional()
  public count?: boolean;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  public limit?: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'offset') })
  @IsOptional()
  public offset?: number;
}

// tslint:disable-next-line:max-classes-per-file
export class GetStatsQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;
}

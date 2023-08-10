import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsNumberString, IsOptional, Matches } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public market?: string;

  @IsOptional()
  public provider?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'amount'),
  })
  @IsOptional()
  public amount?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'price'),
  })
  @IsOptional()
  public price?: string;

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

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];
}

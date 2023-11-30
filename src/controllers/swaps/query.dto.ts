import { getChainNames } from '@jointlabs/chains-info';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { SearchStatus, SwapType } from '../../models/swap';

export class GetQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];

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
export class ListQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public marketAddress?: string;

  @IsOptional()
  base?: string;

  @IsOptional()
  quote?: string;

  @IsOptional()
  public address?: string;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'fromDate') })
  @IsOptional()
  fromDate?: string;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'toDate') })
  @IsOptional()
  toDate?: string;

  @IsEnum(SearchStatus, { message: makeValidatorMsg('must be a valid status', 'status') })
  @IsOptional()
  status?: SearchStatus;

  @IsEnum(SwapType, { message: makeValidatorMsg('must be a valid swap type', 'type') })
  @IsOptional()
  type?: SwapType;

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];

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
export class GetParticipantsDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'includeRedispute') })
  @IsOptional()
  public includeRedispute?: boolean;
}

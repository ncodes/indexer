import { IsBoolean, IsEnum, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toBoolean } from 'underscore.string';
import { toNumber } from 'lodash';
import { SearchStatus } from '../../models/offer';

export class BaseQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;
}

export class GetQueryDTO extends BaseQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
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

export class GetParamDTO {
  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'offerId') })
  @IsNotEmpty({ message: makeValidatorMsg('offer ID is required', 'offerId') })
  public offerId: number;
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public creator?: string;

  @IsOptional()
  public marketAddress?: string;

  @IsOptional()
  public provider: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  public lid: number;

  @IsOptional()
  public creatorOrProvider: string;

  @IsEnum(SearchStatus, { message: makeValidatorMsg('must be a valid status', 'status') })
  @IsOptional()
  status?: SearchStatus;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'fromDate') })
  @IsOptional()
  fromDate?: string;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'toDate') })
  @IsOptional()
  toDate?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'count') })
  @IsOptional()
  public count?: boolean;

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

export class ReadQueryDTO extends BaseQueryDTO {
  @IsOptional()
  public marketAddress?: string;

  @IsOptional()
  public provider?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'lid') })
  @IsOptional()
  public lid?: number;
}

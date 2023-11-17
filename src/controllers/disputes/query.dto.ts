import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { SearchStatus } from '../../models/dispute';
import { getNetworks } from '../../network/common';

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public marketAddress?: string;

  @IsOptional()
  public participant?: string;

  @IsOptional()
  public creator?: string;

  @IsOptional()
  public defendant?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  @IsOptional()
  public orderId?: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, {
    message: makeValidatorMsg('must be a number', 'disputeId'),
  })
  @IsOptional()
  public disputeId?: number;

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

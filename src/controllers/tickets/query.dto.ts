import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { SearchStatus } from '../../models/ticket';
import { getNetworks } from '../../network/common';

export class GetQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public owner?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'index') })
  @IsOptional()
  public index?: number;

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'poolId') })
  @IsOptional()
  public poolId?: number;

  @IsOptional()
  public owner?: string;

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

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'joined') })
  @IsOptional()
  public joined?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'matured') })
  @IsOptional()
  public matured?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'drafted') })
  @IsOptional()
  public drafted?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'expired') })
  @IsOptional()
  public expired?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'cancelled') })
  @IsOptional()
  public cancelled?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'slashed') })
  @IsOptional()
  public slashed?: boolean;

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

// tslint:disable-next-line:max-classes-per-file
export class StatsQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public owner?: string;
}

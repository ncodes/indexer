import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';

export class GetQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'network') })
  public net?: string;

  @IsOptional()
  public owner?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'index') })
  @IsOptional()
  public index?: number;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'noMerge') })
  @IsOptional()
  public noMerge?: boolean;

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];
}

// tslint:disable-next-line:max-classes-per-file
export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'network') })
  public net?: string;

  @IsOptional()
  public marketId?: string;

  @IsOptional()
  public owner?: string;

  @IsOptional()
  public delegate?: string;

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
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'noMerge') })
  @IsOptional()
  public noMerge?: boolean;

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

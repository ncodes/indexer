import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsNumberString, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'network') })
  public net?: string;

  @IsOptional()
  public marketId?: string;

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

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'appeal') })
  @IsOptional()
  public appeal?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'executed') })
  @IsOptional()
  public executed?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'released') })
  @IsOptional()
  public released?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'abandoned') })
  @IsOptional()
  public abandoned?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'orderReleased') })
  @IsOptional()
  public orderReleased?: boolean;

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

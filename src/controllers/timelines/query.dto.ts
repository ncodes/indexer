import { getChainNames } from '@jointlabs/meta';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Validate } from 'class-validator';
import { toNumber } from 'lodash';
import { LiquidityDescriptionValidator, makeValidatorMsg } from '../../common/validations/validation';

class LiquidityDTO {
  @IsString({ message: makeValidatorMsg('must be a string', 'provider') })
  public provider: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'lid') })
  public lid: number;
}

export class GetQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => JSON.parse(value as string))
  @IsOptional()
  public markets?: string[];

  @Transform(({ value }) => JSON.parse(value as string))
  @IsOptional()
  public wallets?: string[];

  @Validate(LiquidityDescriptionValidator)
  @Transform(({ value }) => JSON.parse(value as string))
  @IsOptional()
  public liquidities?: LiquidityDTO[];

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  public limit?: number;

  @Transform(({ value }) => toNumber(value))
  @IsOptional()
  public lastSerial?: number;
}

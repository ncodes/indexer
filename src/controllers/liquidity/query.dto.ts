import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, Matches } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';
import { Transform } from 'class-transformer';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';

export class GetQueryDTO {
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
  public provider: string;

  public mid: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('liquidity ID must be a number', 'lid') })
  @IsNotEmpty({ message: makeValidatorMsg('liquidity ID is required', 'lid') })
  public lid: number;
}

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public market?: string;

  @IsOptional()
  public provider?: string;

  @IsOptional()
  public base?: string;

  @IsOptional()
  public quote?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'amount'),
  })
  @IsOptional()
  public amount?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'amountUsd'),
  })
  @IsOptional()
  public amountUsd?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'priceUsd'),
  })
  @IsOptional()
  public priceUsd?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'price'),
  })
  @IsOptional()
  public price?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'kycLp') })
  @IsOptional()
  public kycLp?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'kycTaker') })
  @IsOptional()
  public kycTaker?: boolean;

  @Transform(({ value }) => (value as string).split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')))
  @IsOptional()
  swapBadges?: string[];

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

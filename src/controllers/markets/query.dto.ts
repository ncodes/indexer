import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, Matches } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';

export class GetQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => (value as string).split(','))
  @IsOptional()
  public select?: string[];
}

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public creator?: string;

  // Transform to string array
  @Transform(({ value }: { value: string }) => value.split(',').map((x) => x.trim()))
  @IsOptional()
  public address?: string[];

  @IsOptional()
  public base?: string;

  @IsOptional()
  public quote?: string;

  @IsOptional()
  public query?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'price'),
  })
  @IsOptional()
  public price?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'priceUsd'),
  })
  @IsOptional()
  public priceUsd?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'liquidity'),
  })
  @IsOptional()
  public liquidity?: string;

  @Matches(/^[<>]?[0-9]+$/, {
    message: makeValidatorMsg(`must be a number (optionally preceded by '>' or '<')`, 'liquidityUsd'),
  })
  @IsOptional()
  public liquidityUsd?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'merchantLp') })
  @IsOptional()
  public merchantLp?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'kycLp') })
  @IsOptional()
  public kycLp?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'kycTaker') })
  @IsOptional()
  public kycTaker?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'offer') })
  @IsOptional()
  public offer?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'permSwap') })
  @IsOptional()
  public permSwap?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'permPut') })
  @IsOptional()
  public permPut?: boolean;

  @Transform(({ value }) => (value as string).split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')))
  @IsOptional()
  regions?: string[];

  @Transform(({ value }) => (value as string).split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')))
  @IsOptional()
  putBadges?: string[];

  @Transform(({ value }) => (value as string).split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')))
  @IsOptional()
  swapBadges?: string[];

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'instant') })
  @IsOptional()
  public instant?: boolean;

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

export class ListPermittedTradersQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  public limit?: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'offset') })
  @IsOptional()
  public offset?: number;
}

export class GetTopMarketsQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  public limit?: number;
}

export class ListPermittedProviderQueryDTO {
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

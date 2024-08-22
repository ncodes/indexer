import { getChainNames } from '@jointlabs/meta';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Validate,
} from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { LiquidityDescriptionValidator, makeValidatorMsg } from '../../common/validations/validation';

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

export class GetParamDTO {
  public provider: string;

  public mid: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('liquidity ID must be a number', 'lid') })
  @IsNotEmpty({ message: makeValidatorMsg('liquidity ID is required', 'lid') })
  public lid: number;
}

export class FillQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;
}

export class FillParamDTO {
  @IsNumberString({}, { message: makeValidatorMsg('must be a number', 'amount') })
  @IsOptional()
  public amount?: string;

  @IsString({ message: makeValidatorMsg('must be a string', 'mid') })
  @IsNotEmpty({ message: makeValidatorMsg('market address is required', 'mid') })
  public mid: string;

  @IsIn(['base', 'quote'], { message: makeValidatorMsg('must be either base or quote', 'side') })
  @IsString({ message: makeValidatorMsg('must be a string', 'side') })
  @IsNotEmpty({ message: makeValidatorMsg('side is required', 'side') })
  public side: 'base' | 'quote';
}

class LiquidityDTO {
  @IsString({ message: makeValidatorMsg('must be a string', 'marketAddress') })
  @IsNotEmpty({ message: makeValidatorMsg('marketAddress is required', 'marketAddress') })
  public marketAddress: string;

  @IsString({ message: makeValidatorMsg('must be a string', 'provider') })
  @IsNotEmpty({ message: makeValidatorMsg('provider is required', 'provider') })
  public provider: string;

  @Transform(({ value }) => toNumber(value))
  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'lid') })
  @IsNotEmpty({ message: makeValidatorMsg('liquidity Id is required', 'lid') })
  public lid: number;
}

export class ListQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
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

  @Validate(LiquidityDescriptionValidator)
  @IsOptional()
  public liquidities?: LiquidityDTO[];

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'paused') })
  @IsOptional()
  public paused?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'isProvider') })
  @IsOptional()
  public isProvider?: boolean;

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

  @Transform(({ value }) =>
    !value ? undefined : value.split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')),
  )
  @IsOptional()
  swapBadges?: string[];

  @Transform(({ value }) =>
    !value ? undefined : value.split(',').map((v) => v.replaceAll('%', '').trim().replace(/\/$/g, '%')),
  )
  @IsOptional()
  paymentMethods?: string[];

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'count') })
  @IsOptional({})
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

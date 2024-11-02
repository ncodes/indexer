import { getChainNames } from '@jointlabs/meta';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEthereumAddress, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';

export class GetQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;
}

export class GetGrantSigDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsNotEmpty({ message: makeValidatorMsg('badge is required', 'badge') })
  public badge: string;

  @IsEthereumAddress({ message: makeValidatorMsg('provider address is invalid', 'address') })
  @IsNotEmpty({ message: makeValidatorMsg('provider address is required', 'address') })
  public address?: string;

  @IsEthereumAddress({ message: makeValidatorMsg('liquidity address is invalid', 'liquidityAddress') })
  @IsNotEmpty({ message: makeValidatorMsg('liquidity address is required', 'liquidityAddress') })
  public liquidityAddress?: string;

  // convert to bool using toBoolean
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('disable is invalid', 'disable') })
  @IsOptional()
  public disable?: boolean;
}

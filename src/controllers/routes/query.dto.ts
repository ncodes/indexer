import { getChainNames } from '@jointlabs/meta';
import { IsEthereumAddress, IsIn, IsNotEmpty, IsNumberString, IsOptional, Max } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class GetQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net: string;

  @IsNumberString({ no_symbols: true }, { message: makeValidatorMsg('minimum bond must be a number', 'minBond') })
  @IsOptional()
  public minBond?: string;

  @IsOptional()
  public maxDepth?: number;

  @IsEthereumAddress({ message: makeValidatorMsg('requester must be a valid Ethereum address', 'requester') })
  @IsOptional()
  public requester?: string;
}

export class UpdatePaymentMethodDTO {
  @IsNotEmpty({ message: makeValidatorMsg('payment method ID is required', 'paymentMethodId') })
  public paymentMethodId: string;
}

export class UpdateFeeDTO {
  @Max(5, { message: makeValidatorMsg('fee cannot be greater than 5', 'fee') })
  @IsNotEmpty({ message: makeValidatorMsg('fee is required', 'fee') })
  public fee: number;
}

export class GetRoutesParamsDTO {
  public region: string;

  public destOrgId: string;
}

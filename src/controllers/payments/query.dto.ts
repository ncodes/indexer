import { getChainNames } from '@jointlabs/meta';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEthereumAddress, IsIn, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
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

export class AddPaymentMethodDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net: string;

  @IsIn([1, 2], { message: makeValidatorMsg('type is unknown', 'type') })
  @IsOptional()
  public type: number;

  @IsNotEmpty({ message: makeValidatorMsg('method name is required', 'name') })
  public name: string;

  @ValidateIf((o) => o.type === 2)
  @IsNotEmpty({ message: makeValidatorMsg('account ID is required', 'accountId') })
  public accountId: string;

  @ValidateIf((o) => o.type === 1)
  @IsNotEmpty({ message: makeValidatorMsg('bank account name is required', 'bankAccountName') })
  public bankAccountName: string;

  @ValidateIf((o) => o.type === 1)
  @IsNotEmpty({ message: makeValidatorMsg('bank account number is required', 'bankAccountNumber') })
  public bankAccountNumber: string;

  @ValidateIf((o) => o.type === 1)
  @IsOptional()
  public routingNumber: string;

  @ValidateIf((o) => o.type === 1)
  @IsOptional()
  public swiftCode: string;

  @IsOptional()
  public additionalInfo: string;
}

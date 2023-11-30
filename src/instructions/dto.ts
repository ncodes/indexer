import { getChainNames } from '@jointlabs/chains-info';
import { IsIn, IsNotEmpty, MaxLength, ValidateIf } from 'class-validator';
import { makeValidatorMsg } from '../common/validations/validation';

export class UpdateInstructionsDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @MaxLength(250, { message: makeValidatorMsg('content is too long', 'content') })
  @IsNotEmpty({ message: makeValidatorMsg('content is required', 'content') })
  content: string;

  @IsNotEmpty({ message: makeValidatorMsg('market address is required', 'marketAddress') })
  @ValidateIf((o) => o.provider !== undefined || o.lid !== undefined)
  marketAddress: string;

  @IsNotEmpty({ message: makeValidatorMsg('provider is required', 'provider') })
  @ValidateIf((o) => o.marketAddress !== undefined || o.lid !== undefined)
  provider: string;

  @IsNotEmpty({ message: makeValidatorMsg('lid is required', 'lid') })
  @ValidateIf((o) => o.provider !== undefined || o.marketAddress !== undefined)
  lid: number;
}

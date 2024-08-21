import { getChainNames } from '@jointlabs/meta';
import { ArrayMinSize, IsIn, IsNotEmpty, ValidateIf } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class SubscribeToConvoDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net: string;

  @ArrayMinSize(1, { message: makeValidatorMsg('at least one topic is required', 'topics') })
  @IsNotEmpty({ message: makeValidatorMsg('at least one topic is required', 'topics') })
  public topics: string[];

  @ValidateIf((o) => o.topics && o.topics.length > 0)
  @ArrayMinSize(1, { message: makeValidatorMsg('at least one peer address is required', 'peerAddresses') })
  @IsNotEmpty({ message: makeValidatorMsg('at least one peer address is required', 'peerAddresses') })
  public peerAddresses: string[];

  @ValidateIf((o) => o.offerId == undefined)
  @IsNotEmpty({ message: makeValidatorMsg('orderId or offerId is required', 'orderId') })
  public orderId: number;

  @ValidateIf((o) => o.orderId == undefined)
  @IsNotEmpty({ message: makeValidatorMsg('offerId is required', 'offerId') })
  public offerId: number;
}

export class UnsubscribeToConvoDTO {
  @ArrayMinSize(1, { message: makeValidatorMsg('at least one topic is required', 'topics') })
  @IsNotEmpty({ message: makeValidatorMsg('at least one topic is required', 'topics') })
  public topics: string[];
}

import { Transform } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'read') })
  @IsOptional()
  public read: boolean;

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

export class SubscribeToConvoDTO {
  @ArrayMinSize(1, { message: makeValidatorMsg('at least one topic is required', 'topics') })
  @IsNotEmpty({ message: makeValidatorMsg('at least one topic is required', 'topics') })
  public topics: string[];

  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net: string;

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

export class ChatNotificationDTO {
  @IsNotEmpty({ message: makeValidatorMsg('token is required', 'token') })
  token: string;

  @IsNotEmpty({ message: makeValidatorMsg('topic is required', 'topic') })
  topic: string;

  @IsNotEmpty({ message: makeValidatorMsg('timestamp is required', 'timestamp') })
  timestamp: number;

  @IsNotEmpty({ message: makeValidatorMsg('message is required', 'message') })
  message: string;
}

export class WebPushSubscribeDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'network') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'network') })
  net: string;

  @IsNotEmpty({ message: makeValidatorMsg('address is required', 'address') })
  address: string;

  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

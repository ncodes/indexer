import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { toNumber } from 'lodash';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';

export class ListQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net?: string;

  @IsOptional()
  public type: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'read') })
  @IsOptional()
  public read: boolean;

  @IsOptional()
  offerId: number;

  @IsOptional()
  orderId: number;

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

export class MarkReadDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsNotEmpty({ message: makeValidatorMsg('network is required', 'net') })
  public net: string;

  @IsOptional()
  public type?: string;

  @IsOptional()
  offerId?: number;

  @IsOptional()
  orderId?: number;
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

import { getChainNames } from '@jointlabs/chains-info';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { toBoolean } from 'underscore.string';
import { makeValidatorMsg } from '../../common/validations/validation';

export type DeviceType = 'email';

export class GetQueryDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsOptional()
  public net?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'no404') })
  @IsOptional()
  no404?: boolean;
}

export class RegisterDeviceDTO {
  @IsIn(['email'], { message: makeValidatorMsg('device type is unknown', 'type') })
  @IsNotEmpty({ message: makeValidatorMsg('device type is required', 'type') })
  public type?: DeviceType;
}

export class LogOnlineStatusDTO {
  @IsIn(getChainNames(), { message: makeValidatorMsg('network is unknown', 'net') })
  public net: string;

  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'orderId') })
  @IsOptional()
  public orderId: number;

  @IsNumber(undefined, { message: makeValidatorMsg('must be a number', 'offerId') })
  @IsOptional()
  public offerId: number;
}

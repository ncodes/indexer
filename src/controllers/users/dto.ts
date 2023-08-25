import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { getNetworks } from '../../network/common';
import { makeValidatorMsg } from '../../common/validations/validation';
import { toBoolean } from 'underscore.string';
import { Transform } from 'class-transformer';

export class GetQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsOptional()
  public net?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: makeValidatorMsg('must be boolean', 'no404') })
  @IsOptional()
  no404?: boolean;
}

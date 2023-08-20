import { IsIn, IsOptional } from 'class-validator';
import { getNetworks } from '../../network/common';
import { makeValidatorMsg } from '../../common/validations/validation';

export class GetQueryDTO {
  @IsIn(getNetworks(), { message: makeValidatorMsg('network is unknown', 'net') })
  @IsOptional()
  public net?: string;
}

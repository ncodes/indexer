import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { getNetworks } from '../../network/common';

export class UploadFileDTO {
  @IsNotEmpty({ message: makeValidatorMsg('at least one file is required', 'files') })
  @IsArray({ message: makeValidatorMsg('files must be an array', 'files') })
  public files: string[];
}

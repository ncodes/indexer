import { IsISO8601, IsNotEmpty, IsNumberString, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class GetLeaderboardDTO {
  @IsNumberString({}, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  limit: string;

  @IsOptional()
  address: string;
}

export class CreatePointsFromCSV {
  @IsNotEmpty({ message: makeValidatorMsg('csv url is required', 'csvUrl') })
  csvUrl: string;
}

export class GetRecentPoints {
  @IsNumberString({}, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  limit: string;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'from') })
  @IsOptional()
  from: string;
}

export class CreatePointFromEnergonBalance {
  @IsNotEmpty({ message: makeValidatorMsg('beneficiary address is required', 'beneficiary') })
  beneficiary: string;

  @IsNotEmpty({ message: makeValidatorMsg('signer address is required', 'signer') })
  signer: string;

  @IsNotEmpty({ message: makeValidatorMsg('signature is required', 'sig') })
  sig: string;
}

import { IsEnum, IsISO8601, IsNotEmpty, IsNumberString, IsOptional } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';

export class GetLeaderboardDTO {
  @IsNumberString({}, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  limit: string;

  @IsOptional()
  referee: string;

  @IsNotEmpty({ message: makeValidatorMsg('referrer is required', 'referrer') })
  referrer: string;
}

export class GetRecentPoints {
  @IsNumberString({}, { message: makeValidatorMsg('must be a number', 'limit') })
  @IsOptional()
  limit: string;

  @IsISO8601({ strict: true }, { message: makeValidatorMsg('must be a valid ISO8601 date', 'from') })
  @IsOptional()
  from: string;

  @IsNotEmpty({ message: makeValidatorMsg('referrer address is required', 'referrer') })
  referrer: string;

  @IsEnum(['asc', 'desc'], { message: makeValidatorMsg('must be either asc or desc', 'order') })
  order = 'asc';
}

/* tslint:disable:max-classes-per-file */
import { IsEthereumAddress, IsIn, IsNotEmpty, IsOptional, Matches, ValidateIf } from 'class-validator';
import { makeValidatorMsg } from '../../common/validations/validation';
import { QuestType } from '../../models/quest';

export class CreateLuckyCodeDTO {
  constructor(init?: Partial<CreateLuckyCodeDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('name is required', 'name') })
  name: string;

  @IsEthereumAddress({ message: makeValidatorMsg('owner address is not valid', 'owner') })
  @IsNotEmpty({ message: makeValidatorMsg('owner is required', 'owner') })
  owner: string;

  @IsNotEmpty({ message: makeValidatorMsg('random is required', 'random') })
  random: boolean;

  @ValidateIf((o) => o.random === true)
  @IsNotEmpty({ message: makeValidatorMsg('minimum amount is required', 'minAmount') })
  minAmount: number;

  @IsNotEmpty({ message: makeValidatorMsg('maximum amount is required', 'maxAmount') })
  maxAmount: number;
}

export class CreateQuestDTO {
  constructor(init?: Partial<CreateQuestDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('name is required', 'name') })
  name: string;

  @IsIn(['tweet', 'follow', 'quote', 'reply', 'verify', 'private-sale', 'swap'], {
    message: makeValidatorMsg('invalid type provided', 'type'),
  })
  @IsNotEmpty({ message: makeValidatorMsg('type is required', 'type') })
  type: QuestType;

  @ValidateIf(
    (o) =>
      o.type != 'tweet' && o.type != 'follow' && o.type != 'verify' && o.type != 'private-sale' && o.type != 'swap',
  )
  @IsNotEmpty({ message: makeValidatorMsg('link is required', 'link') })
  link: string;

  tag: string;

  @ValidateIf((o) => o.type == 'follow')
  @IsNotEmpty({ message: makeValidatorMsg('account is required', 'account') })
  account: string;

  @IsNotEmpty({ message: makeValidatorMsg('engage bond is required', 'engageBond') })
  engageBond: number;

  @IsNotEmpty({ message: makeValidatorMsg('verify bond is required', 'verifyBond') })
  verifyBond: number;

  @IsNotEmpty({ message: makeValidatorMsg('maxVotes is required', 'maxVotes') })
  maxVotes: number;

  @IsNotEmpty({ message: makeValidatorMsg('verifyPoints is required', 'verifyPoints') })
  verifyPoints: number;

  @IsNotEmpty({ message: makeValidatorMsg('engagePoints is required', 'engagePoints') })
  engagePoints: number;

  @ValidateIf((o) => o.type == 'swap')
  @IsNotEmpty({ message: makeValidatorMsg('market address is required', 'marketAddress') })
  marketAddress: string;

  @ValidateIf((o) => o.type == 'swap')
  @IsNotEmpty({ message: makeValidatorMsg('provider is required', 'provider') })
  @IsOptional()
  provider: string;

  @ValidateIf((o) => o.type == 'swap')
  @IsNotEmpty({ message: makeValidatorMsg('lid is required', 'lid') })
  @IsOptional()
  lid: number;

  @ValidateIf((o) => o.type == 'swap')
  @IsNotEmpty({ message: makeValidatorMsg('count is required', 'lid') })
  count: number;

  priority: number;
}

export class RequestQuestVerify {
  constructor(init?: Partial<RequestQuestVerify>) {
    Object.assign(this, init);
  }

  type: string;

  @ValidateIf((o) => o.type == 'tweet' || o.type == 'quote' || o.type == 'reply')
  @Matches(/https:\/\/(twitter|x).com\/[a-zA-Z0-9_]+\/status\/[0-9]+/, {
    message: makeValidatorMsg('invalid link provided', 'link'),
  })
  @IsNotEmpty({ message: makeValidatorMsg('tweet link is required', 'link') })
  link: string;
}

export class VoteQuest {
  constructor(init?: Partial<VoteQuest>) {
    Object.assign(this, init);
  }

  @IsIn([0, 1], { message: makeValidatorMsg('vote must be 0 or 1', 'vote') })
  @IsNotEmpty({ message: makeValidatorMsg('vote is required', 'vote') })
  vote: number;
}

export class ApplyPresale {
  constructor(init?: Partial<ApplyPresale>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('country is required', 'country') })
  country: string;
}

export class GetRaffles {
  constructor(init?: Partial<GetRaffles>) {
    Object.assign(this, init);
  }

  @IsOptional()
  userId: string;
}

export class StakeBondDTO {
  constructor(init?: Partial<StakeBondDTO>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('amount is required', 'amount') })
  amount: string;

  @IsNotEmpty({ message: makeValidatorMsg('side is required', 'side') })
  @IsIn(['droid', 'bandit'], { message: makeValidatorMsg('invalid side provided', 'side') })
  side: 'droid' | 'bandit';

  @IsNotEmpty({ message: makeValidatorMsg('battleId is required', 'battleId') })
  battleId: string;
}

export class GrantTapsBonus {
  constructor(init?: Partial<GrantTapsBonus>) {
    Object.assign(this, init);
  }

  @IsNotEmpty({ message: makeValidatorMsg('name is required', 'name') })
  name: string;

  @IsNotEmpty({ message: makeValidatorMsg('amount is required', 'amount') })
  amount: string;

  @IsNotEmpty({ message: makeValidatorMsg('addressOrTelegramId is required', 'addressOrTelegramId') })
  addressOrTelegramId: string;
}

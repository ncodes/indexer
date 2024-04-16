import {
  Body,
  Controller,
  Get,
  HttpException,
  Logger,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { isNegative, validate } from 'class-validator';
import { Request } from 'express';
import * as moment from 'moment';
import { transaction } from 'objection';
import { Client } from 'twitter-api-sdk';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw401 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { IsRootAdmin } from '../../guards/is_basic_admin';
import Allocation from '../../models/allocations';
import LuckyCode from '../../models/lucky_code';
import NFTOwner from '../../models/nft_owner';
import Point, { PointAction } from '../../models/point';
import Quest from '../../models/quest';
import Swap from '../../models/swap';
import User from '../../models/user';
import { powOf } from '../../network/common';
import DiscordService from '../../services/discord.service';
import { TwitterService } from '../../services/twitter.service';
import { NFTAllocations } from '../points/data/nft_allocation';
import { PointMap } from '../points/data/points';
import { ApplyPresale, CreateLuckyCodeDTO, CreateQuestDTO, RequestQuestVerify, VoteQuest } from './dto';

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

@Controller('v1/airdrop')
export class AirdropController {
  private logger = new Logger(AirdropController.name);

  constructor(private cfgSrv: ConfigService, private twitterSrv: TwitterService, private discordSrv: DiscordService) {}

  /**
   * Link twitter user to a user account
   * @param code The twitter user authorization code
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/link-twitter/:code')
  async linkTwitterUser(@Req() req: Request, @Param('code') code: string) {
    // Get user basic information
    const accessToken = await this.twitterSrv.getOAuthToken(code);
    const userInfo = await new Client(accessToken).users.findMyUser();

    // Check if twitter user already linked to another account
    const userWithTwitter = await User.getByTwitterUsername(userInfo.data.username);
    if (userWithTwitter && userWithTwitter.id !== req.user.id) {
      throw401('Twitter already linked to another account');
    }

    await transaction(User, Point, async (User, Point) => {
      const user = await User.updateById(req.user.id, {
        twitterUserId: userInfo.data.id,
        twitterUsername: userInfo.data.username,
        twitterToken: accessToken,
        twitterLinkedAt: moment().toISOString(),
      });

      // Grant point if not previously granted for this twitter user
      // and the user has not connected twitter before
      const pointName = `twitter:connect:${user.twitterUsername}`;
      const existingPoint = await Point.getByName(pointName);
      if (!existingPoint && !req.user.twitterLinkedAt) {
        await Point.create({
          network: '',
          name: pointName,
          address: user.address,
          point: PointMap['twitter:connect'].toString(),
          action: PointAction.TwitterConnect,
        });
      }
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Unlink twitter user from a user account
   * @param req The request object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/unlink-twitter')
  async unlinkTwitter(@Req() req: Request) {
    await User.updateById(req.user.id, { twitterUsername: null, twitterToken: null });
    return ok().data({ ok: true }).build();
  }

  /**
   * Link discord user to a user account
   * @param code The user authorization code
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/link-discord/:code')
  async linkDiscordUser(@Req() req: Request, @Param('code') code: string) {
    // Get access token fror auth code
    const accessToken = await this.discordSrv.getToken(code);

    // Get user basic info
    const discordUser = await this.discordSrv.getMe(accessToken);

    // Find existing user with the same discord ID
    const existingUser = await User.getByDiscordId(discordUser.username);
    if (existingUser && req.user.id != existingUser.id) {
      throw401('Discord already linked to another account');
    }

    // Get user guilds
    const userGuilds = await this.discordSrv.getUserGuilds(accessToken);

    // Ensure user is a member of Joint guild
    const jointGuildId = this.cfgSrv.get('app.discord.jointGuildId');
    const guild = userGuilds.find((guild: { id: any }) => guild.id === jointGuildId);
    if (!guild) throw400('Not a member of Joint discord server');

    // Get user's Joint guild information
    const userJointGuildInfo = await this.discordSrv.getUserGuildInfo(accessToken, jointGuildId);

    await transaction(User, Point, async (User, Point) => {
      const user = await User.updateById(req.user.id, {
        discordId: discordUser.username,
        discordToken: accessToken,
        discordLinkedAt: moment().toISOString(),
        isEarlyDiscordMember: userJointGuildInfo.roles.includes('1041308260600397884'),
      });

      // Grant point if not previously granted for this discord user
      // and the user has not connected discord before
      const pointName = `discord:connect:${user.discordId}`;
      const existingPoint = await Point.getByName(pointName);
      if (!existingPoint && !req.user.discordLinkedAt) {
        await Point.create({
          network: '',
          name: pointName,
          address: user.address,
          point: PointMap['discord:connect'].toString(),
          action: PointAction.DiscordConnect,
        });
      }
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Unlink discord user from a user account
   * @param req The request object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/unlink-discord')
  async unlinkDiscord(@Req() req: Request) {
    await User.updateById(req.user.id, { discordId: null, discordToken: null });
    return ok().data({ ok: true }).build();
  }

  /**
   * Create and issue a Lucky Code
   * @param body The body of the request
   */
  @UseGuards(IsRootAdmin)
  @Post('/lucky-codes')
  async createLuckyCode(@Body(new ValidationPipe(CommonValidationPipeOpt)) body: CreateLuckyCodeDTO) {
    const existingLuckyCode = await LuckyCode.getByCode(body.name);
    if (existingLuckyCode) throw400('Lucky code already exists');

    return ok()
      .data(
        await LuckyCode.create({
          code: body.name,
          owner: body.owner,
          minAmount: body.minAmount.toString(),
          maxAmount: body.maxAmount.toString(),
          random: body.random,
          amount: !body.random ? powOf(body.maxAmount.toString(), 18).toString() : '0',
        }),
      )
      .build();
  }

  /**
   * Apply a Lucky Code
   * @param req The request object
   * @param code The lucky code
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/lucky-codes/claim/:code')
  async applyLuckyCode(@Req() req: Request, @Param('code') code: string) {
    const luckyCode = await LuckyCode.getByCodeAndAddress(code, req.user.address);
    if (!luckyCode) throw400('Code is unknown');
    if (luckyCode.claimed) throw400('Code already claimed');

    // Get the lucky code actual amount
    const amount = luckyCode.random
      ? powOf(randomInteger(parseFloat(luckyCode.minAmount), parseFloat(luckyCode.maxAmount)), 18)
      : luckyCode.amount;

    // Mark the lucky code as claimed and create an allocation
    await transaction(LuckyCode, Allocation, async (LuckyCode, Allocation) => {
      await LuckyCode.updateById(luckyCode.id, {
        claimed: true,
        amount: amount.toString(),
      });

      await Allocation.create({
        name: luckyCode.id,
        owner: req.user.address,
        amount: amount.toString(),
      });
    });

    return ok().data({ amount: amount.toString() }).build();
  }

  /**
   * Claim NFT allocation
   * @param req The request object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/claim-alloc/nft')
  async claimNFTAllocation(@Req() req: Request) {
    const existingAllocation = await Allocation.getByName(`droidpd:${req.user.address}`);
    if (existingAllocation) throw400('Already claimed');

    // Calculate total allocation
    const nftsOwned = await NFTOwner.findByAddress(req.user.address);
    let totalAlloc = 0;
    for (const n of nftsOwned) {
      totalAlloc += NFTAllocations[n.tokenId.toString()];
    }

    if (totalAlloc === 0) throw400('No NFTs owned');

    // Create an allocation
    await Allocation.create({
      name: `droidpd:${req.user.address}`,
      owner: req.user.address,
      amount: powOf(totalAlloc.toString(), 18).toString(),
    });

    return ok().data({ amount: totalAlloc.toString() }).build();
  }

  /**
   * Claim early member allocation
   * @param req The request object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/claim-alloc/early-member')
  async claimEarlyMemberAllocation(@Req() req: Request) {
    const existingAllocation = await Allocation.getByName(`early_member:${req.user.address}`);
    if (existingAllocation) throw400('Already claimed');

    // Calculate total allocation
    const totalAlloc = req.user.isEarlyDiscordMember ? this.cfgSrv.get('app.discord.earlyMemberAlloc') : '0';

    if (totalAlloc === '0') throw400('No early member allocation');

    // Create an allocation
    await Allocation.create({
      name: `early_member:${req.user.address}`,
      owner: req.user.address,
      amount: powOf(totalAlloc.toString(), 18).toString(),
    });

    return ok().data({ amount: totalAlloc.toString() }).build();
  }

  /**
   * Claim points allocation
   * @param req The request object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/claim-alloc/points')
  async claimPointsAllocation(@Req() req: Request) {
    const existingAllocation = await Allocation.getByName(`points:${req.user.address}`);
    if (existingAllocation) throw400('Already claimed');

    // Calculate total allocation
    // TODO: use proper calculation
    const totalAlloc = 1250;

    // if (totalAlloc == 0) throw400('No point allocation');

    // Create an allocation
    await Allocation.create({
      name: `points:${req.user.address}`,
      owner: req.user.address,
      amount: powOf(totalAlloc.toString(), 18).toString(),
    });

    return ok().data({ amount: totalAlloc.toString() }).build();
  }

  /**
   * Create a quest
   * @param body The body of the request
   * @returns
   */
  @UseGuards(IsRootAdmin)
  @Post('/create-quest')
  async createQuest(@Body(new ValidationPipe(CommonValidationPipeOpt)) body: CreateQuestDTO) {
    const existing = await Quest.findByName(body.name);
    if (existing) throw400('Quest already exists');

    const quest = await Quest.create({
      name: body.name,
      type: body.type,
      link: body.link,
      account: body.account,
      engageBond: body.engageBond,
      verifyBond: body.verifyBond,
      maxVotes: body.maxVotes,
      verifyPoints: body.verifyPoints,
      engagePoints: body.engagePoints,
      pinned: true,
      priority: body.priority,
      marketAddress: body.marketAddress,
      provider: body.provider,
      lid: body.lid,
    });

    return ok().data(quest).build();
  }

  /**
   * Get quests
   * @param req
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/get-quests')
  async getQuests(@Req() req: Request) {
    let pinnedQuests = await Quest.getAllPinned();

    pinnedQuests = pinnedQuests.filter((quest) => {
      return !req.user.presale || quest.type != 'private-sale';
    });

    const votableQuests = await Quest.findVotableQuests(req.user.id, req.user.address, 5);
    return ok()
      .data([...pinnedQuests, ...votableQuests])
      .build();
  }

  /**
   * Request for quest verification
   * @param req The request object
   * @param questId The quest ID
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('request-verify/:questId')
  async createVerifyQuest(@Req() req: Request, @Param('questId') questId, @Body() body: RequestQuestVerify) {
    if (!req.user.twitterUserId) throw400('Twitter not linked');

    const id = body.link ? this.twitterSrv.getTweetIdFromUrl(body.link) : req.user.id;
    const existing = await Quest.findByName(`verify-${questId}-${id}`);
    if (existing) throw400('Verification request already exists');

    const quest = await Quest.getById(questId);
    if (!quest) throw400('Quest not found');

    body = plainToInstance(RequestQuestVerify, {
      type: quest.type,
      link: body.link,
    });

    // Handle validation error
    const errors = await validate(body);
    if (errors.length > 0 && errors[0].constraints) {
      const err = JSON.parse(errors[0].constraints[Object.keys(errors[0].constraints)[0]]);
      throw new HttpException(err.response, err.status);
    }

    const numVerifyQuestsLast24Hrs = await Quest.countVerifyQuests(req.user.id);
    if (numVerifyQuestsLast24Hrs >= parseInt(this.cfgSrv.get('app.maxDailyQuestVerify'))) {
      throw400('You have reached the maximum daily limit');
    }

    // Make sure link was not reused
    if (body.link) {
      const tweetId = body.link.replace(/\/$/, '').split('/').pop();
      const record = await Quest.findByTweetID(tweetId);
      if (record) throw400('Link already used for another quest');
    }

    // Create verify quest
    const verifyQuest = await Quest.create({
      name: `verify-${questId}-${req.user.id}`,
      type: 'verify',
      responderLink: body.link,
      responderId: req.user.id,
      questId,
    });

    // Deduct engage bond points
    await Point.create({
      name: `engage-bond-${verifyQuest.id}-${req.user.id}`,
      address: req.user.address,
      point: isNegative(quest.engageBond) ? quest.engageBond.toString() : `-${quest.engageBond}`,
      action: PointAction.QuestBond,
    });

    return ok().data(verifyQuest).build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/vote-quest/:questId')
  async voteQuest(
    @Req() req: Request,
    @Param('questId') questId,
    @Body(new ValidationPipe(CommonValidationPipeOpt)) body: VoteQuest,
  ) {
    if (!req.user.twitterUserId) throw400('Twitter not linked');

    let quest = await Quest.getById(questId);
    if (!quest) throw400('Quest not found');

    if (quest.type !== 'verify') throw400('Invalid quest type');
    if (quest.finalized) throw400('Quest already finalized');
    if (quest.voters.includes(req.user.id) || quest.voters.includes(req.user.address.toLowerCase()))
      throw400('Already voted');
    if (quest.responderId === req.user.id) throw400('Cannot vote on own quest');

    const parentQuest = await Quest.getById(quest.questId);
    if (!parentQuest) throw400('Parent quest not found');

    const responder = await User.getById(quest.responderId);
    if (!responder) throw400('Responder not found');

    await transaction(Quest, Point, async (Quest, Point) => {
      const voteState = {
        voteYes: body.vote === 1 ? quest.voteYes + 1 : quest.voteYes,
        voteNo: body.vote === 0 ? quest.voteNo + 1 : quest.voteNo,
      };

      quest = await Quest.updateById(quest.id, {
        voters: [...quest.voters, req.user.id, req.user.address.toLowerCase()],
        votes: { ...quest.votes, [req.user.id]: body.vote, [req.user.address.toLowerCase()]: body.vote },
        finalized: voteState.voteYes + voteState.voteNo >= parentQuest.maxVotes,
        ...voteState,
      });

      // Deduct verify bond points
      await Point.create({
        name: `verify-bond-${questId}-${req.user.id}`,
        address: req.user.address,
        point: isNegative(parentQuest.verifyBond) ? parentQuest.verifyBond.toString() : `-${parentQuest.verifyBond}`,
        action: PointAction.QuestBond,
      });

      if (quest.finalized) {
        const majority = Math.ceil(parentQuest.maxVotes * 0.51);
        const yesWon = quest.voteYes >= majority;
        const noWon = quest.voteNo >= majority;

        // If YES, Give responder back their bond + engagement point
        if (yesWon) {
          await Point.create({
            name: `quest-${questId}-${responder.id}-reward`,
            address: responder.address,
            point: (parentQuest.engageBond + parentQuest.engagePoints).toString(),
            action: PointAction.Quest,
          });
        }

        if (yesWon || noWon) {
          // Give majority voters points + their bond. Remove id starting with 0x
          for (const id of Object.keys(quest.votes)) {
            if (yesWon && quest.votes[id] === 0) continue;
            if (noWon && quest.votes[id] === 1) continue;
            if (!id.startsWith('0x')) continue;
            await Point.create({
              name: `quest-${questId}-${id}-voter-reward`,
              address: id,
              point: Number(parentQuest.verifyBond + parentQuest.verifyPoints).toString(),
              action: PointAction.Quest,
            });
          }
        }
      }
    });

    return ok().data({ ok: true }).build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/apply-presale')
  async applyForPresale(@Req() req: Request, @Body(new ValidationPipe(CommonValidationPipeOpt)) body: ApplyPresale) {
    if (req.user.presale) return ok().data({ ok: true }).build();

    if (body.country.length != 2) {
      return throw400('invalid country code');
    }

    const quest = await Quest.findByTypeAndName('private-sale', 'main');
    if (!quest) throw400('Quest not found');

    await User.updateById(req.user.id, {
      presale: true,
      presaleCountry: body.country,
      ipCountry: req.headers['cf-ipcountry'] as string,
    });

    // Deduct engage point
    await Point.create({
      name: `presale-engage-${req.user.id}`,
      address: req.user.address,
      point: isNegative(quest.engageBond) ? quest.engageBond.toString() : `-${quest.engageBond}`,
      action: PointAction.QuestBond,
    });

    return ok().data({ ok: true }).build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/verify-swap/:questId')
  async verifySwapQuest(@Req() req: Request, @Param('questId') questId: string) {
    const quest = await Quest.getById(questId);
    if (!quest) throw400('Quest not found');
    if (quest.type != 'swap') throw400('Invalid quest type');

    const name = `swap-verify-${questId}-${req.user.id}`;
    const existing = await Point.getByName(name);
    if (existing) throw400('Already verified');

    const count = await Swap.countSwapsOfTakerForLiquidity(
      req.user.address,
      quest.marketAddress,
      quest.provider,
      quest.lid,
    );

    if (count < parseInt(quest.count)) {
      throw400(`Not enough swaps completed (${parseInt(quest.count) - count} to go)`);
    }

    await Point.create({
      name,
      address: req.user.address,
      point: quest.engagePoints.toString(),
      action: PointAction.Quest,
    });

    return ok().data({ ok: true }).build();
  }
}

import { Body, Controller, Logger, Param, Post, Put, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Request } from 'express';
import * as moment from 'moment';
import { transaction } from 'objection';
import * as qs from 'qs';
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
import User from '../../models/user';
import { powOf } from '../../network/common';
import { NFTAllocations } from '../points/data/nft_allocation';
import { PointMap } from '../points/data/points';
import { CreateLuckyCodeDTO } from './dto';

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

@Controller('v1/airdrop')
export class AirdropController {
  private logger = new Logger(AirdropController.name);

  constructor(private cfgSrv: ConfigService) {}

  /**
   * Link twitter user to a user account
   * @param code The twitter user authorization code
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/link-twitter/:code')
  async linkTwitterUser(@Req() req: Request, @Param('code') code: string) {
    const res = await axios({
      method: 'post',
      url: 'https://api.twitter.com/2/oauth2/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: qs.stringify({
        code: code,
        grant_type: 'authorization_code',
        client_id: this.cfgSrv.get('app.twitter.oauthClientId'),
        redirect_uri: this.cfgSrv.get('app.twitter.callbackUrl'),
        code_verifier: 'challenge',
      }),
    });

    // Get user basic information
    const accessToken = res.data.access_token;
    const userInfo = await new Client(accessToken).users.findMyUser();

    // Check if twitter user already linked to another account
    const userWithTwitter = await User.getByTwitterUsername(userInfo.data.username);
    if (userWithTwitter && userWithTwitter.id !== req.user.id) {
      throw401('Twitter already linked to another account');
    }

    await transaction(User, Point, async (User, Point) => {
      const user = await User.updateById(req.user.id, {
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
    const getTokenResp = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: this.cfgSrv.get('app.discord.clientId'),
        client_secret: this.cfgSrv.get('app.discord.clientSecret'),
        grant_type: 'authorization_code',
        redirect_uri: this.cfgSrv.get('app.discord.redirectUri'),
        scope: 'identify,guilds',
        code: code,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    // Get user basic info
    const getUserInfoResp = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${getTokenResp.data.access_token}` },
    });

    // Get user guilds
    const getUserGuildsResp = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${getTokenResp.data.access_token}` },
    });

    // Find existing user with the same discord ID
    const existingUser = await User.getByDiscordId(getUserInfoResp.data.username);
    if (existingUser && req.user.id != existingUser.id) {
      throw401('Discord already linked to another account');
    }

    // Ensure user is a member of Joint guild
    const jointGuildId = this.cfgSrv.get('app.discord.jointGuildId');
    const guild = getUserGuildsResp.data.find((guild: { id: any }) => guild.id === jointGuildId);
    if (!guild) throw400('Not a member of Joint discord server');

    // Get user's Joint guild information
    const getUserJointGuildInfoResp = await axios.get(
      `https://discord.com/api/users/@me/guilds/${jointGuildId}/member`,
      { headers: { Authorization: `Bearer ${getTokenResp.data.access_token}` } },
    );

    await transaction(User, Point, async (User, Point) => {
      const user = await User.updateById(req.user.id, {
        discordId: getUserInfoResp.data.username,
        discordToken: getTokenResp.data.access_token,
        discordLinkedAt: moment().toISOString(),
        isEarlyDiscordMember: getUserJointGuildInfoResp.data.roles.includes('1041308260600397884'),
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
}

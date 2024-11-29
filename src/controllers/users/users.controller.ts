import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEthereumAddress } from 'class-validator';
import { isAddress } from 'ethers';
import express from 'express';
import * as moment from 'moment';
import { transaction } from 'objection';
import { isEqualStr, isProd, toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorMessages, ok, throw400, throw401, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { IsRootAdmin } from '../../guards/is_basic_admin';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import { AllocatorName } from '../../jobs/allocators/common';
import ClaimCheckLog from '../../models/claim_check_log';
import NFTOwner from '../../models/nft_owner';
import Offer from '../../models/offer';
import OnlineStatus from '../../models/online_status';
import Point from '../../models/point';
import Swap from '../../models/swap';
import TokenClaim from '../../models/token_claim';
import User from '../../models/user';
import { pow10 } from '../../network/common';
import NetworkService from '../../network/network.service';
import EtherScanService from '../../services/etherscan.service';
import { getTokenEnergonAlloc } from '../points/point.service';
import * as galxePoints from './data/glaxe.json';
import { GetQueryDTO, LogOnlineStatusDTO, RegisterDeviceDTO } from './dto';
import { UserService } from './user.service';

const chains = [
  {
    name: 'ethereum',
    id: 1,
    startBlock: 18_908_895,
    endBlock: 21_246_710,
    routers: [
      '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    ],
  },
  {
    name: 'base',
    id: 8453,
    startBlock: 8_638_927,
    endBlock: 22_765_326,
    routers: [
      '0x2626664c2603336E57B271c5C0b26F421741e481',
      '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
      '0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4',
      '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    ],
  },
  {
    name: 'arbitrum',
    id: 42161,
    startBlock: 165_788_861,
    endBlock: 277_293_998,
    routers: [
      '0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5',
      '0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4',
      '0x5E325eDA8064b456f4781070C0738d849c824258',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
    ],
  },
  {
    name: 'optimism',
    id: 10,
    startBlock: 114_234_212,
    endBlock: 128_360_611,
    routers: [
      '0xb555edF5dcF85f42cEeF1f3630a52A108E55A654',
      '0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4',
      '0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
    ],
  },
  {
    name: 'bsc',
    id: 56,
    startBlock: 34_848_730,
    endBlock: 44_246_411,
    routers: [
      '0x5Dc88340E1c5c6366864Ee415d6034cadd1A9897',
      '0xeC8B0F7Ffe3ae75d7FfAb09429e3675bb63503e4',
      '0x4Dae2f939ACf50408e13d58534Ff8c2776d45265',
      '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2',
      '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
      // PancakeSwap Routers
      '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      '0x1A0A18AC4BECDDbd6389559687d1A73d8927E416',
      '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
    ],
  },
  {
    name: 'polygon',
    id: 137,
    startBlock: 51_796_222,
    endBlock: 64_613_840,
    routers: [
      '0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5',
      '0x643770E279d5D0733F21d6DC03A8efbABf3255B4',
      '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
    ],
  },
];

@Controller('v1/users')
export class UsersController {
  constructor(
    private userSrv: UserService,
    private netSrv: NetworkService,
    private cfgSrv: ConfigService,
    private etherscanSrv: EtherScanService,
  ) {}

  computeAlloc() {
    let claimStartTimeStr = this.cfgSrv.get('app.claimStartTime');
    if (!claimStartTimeStr) claimStartTimeStr = moment().unix().toString();
    const claimStartTime = moment.unix(parseInt(claimStartTimeStr));
    const numWeeks = moment().diff(claimStartTime, 'weeks');
    return Math.max(10_000 - 1000 * numWeeks, 5_000);
  }

  @UseGuards(IsRootAdmin)
  @Get('/check-dex-claim/:address')
  async checkDexUseOnly(@Param('address') address: string) {
    const userAddress = address;
    const name = `dex_user:${userAddress}`;

    const existingClaim = await TokenClaim.findByName(name);
    if (existingClaim) return ok().data(existingClaim).build();

    let found = false;
    let txHash = '';
    let chainName = '';
    for (const chain of chains) {
      const checkLog = await ClaimCheckLog.findByChainAndAddress(chain.id, userAddress);
      if (!checkLog) {
        const resp = await this.etherscanSrv.check({ ...chain, userAddress });
        if (resp.foundTx) {
          found = true;
          txHash = resp.txHash;
          chainName = chain.name;
          break;
        }
      }
    }

    console.log('Found:', chainName, txHash);

    if (!found) {
      return throw404('not eligible');
    }

    return ok().data({ eligible: true }).build();
  }

  @Post('/check-dex-claim/:address')
  async checkAndRegisterDexClaim(@Param('address') address: string) {
    const userAddress = address;
    const name = `dex_user:${userAddress}`;

    const existingClaim = await TokenClaim.findByName(name);
    if (existingClaim) return ok().data(existingClaim).build();

    let found = false;
    for (const chain of chains) {
      const checkLog = await ClaimCheckLog.findByChainAndAddress(chain.id, userAddress);
      if (!checkLog) {
        const resp = await this.etherscanSrv.check({ ...chain, userAddress });
        await ClaimCheckLog.create({ chainId: chain.id, address: userAddress });
        if (resp.foundTx) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return throw404('not eligible');
    }

    const claimId = 0;
    const alloc = this.computeAlloc();
    const amount = toDec(alloc).mul(pow10(18)).toFixed(0);
    const signature = await getClaimSig(
      this.cfgSrv.get('app.claimSigner'),
      userAddress,
      amount,
      claimId,
      0,
      isProd() ? 8453 : 31337,
    );
    const claim = await TokenClaim.create({
      name,
      address: userAddress,
      amount,
      claimId,
      signature,
    });

    return ok().data(claim).build();
  }

  /**
   * Get a user by address or user ID. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param addressOrUserId The target user address
   * @param q The query object
   * @param [q.net] The network name
   * @param [q.no404] Return a zero User object if user was not found
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get('/:addressOrUserId')
  async get(
    @Req() req: express.Request,
    @Param('addressOrUserId') addressOrUserId: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    if (req.user && !isEqualStr(req.user.address, addressOrUserId) && !isEqualStr(req.user.id, addressOrUserId)) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = isEthereumAddress(addressOrUserId)
        ? await User.getByAddress(addressOrUserId)
        : await User.getById(addressOrUserId);

      if (!user && !q.no404) throw404(ErrorMessages.UserNotFound);

      if (!user && q.no404) {
        return ok()
          .data({
            address: addressOrUserId,
            volume: '0',
            volumeUsd: 0,
            totalSwaps: 0,
            completionRate: 0,
            badges: [],
          })
          .build<User>();
      }
    }

    await this.userSrv.extendUser(user, q.net);

    // Check if the user has performed a swap
    if (!user.hasSwapped) {
      const claimStartTime = this.cfgSrv.get('app.claimStartTime');
      let swapCount = await Swap.countByAddress(user.address, moment.unix(parseInt(claimStartTime)).toISOString());
      let hasSwapped = false;
      if (swapCount > 0) hasSwapped = true;

      if (!hasSwapped) {
        swapCount = await Swap.countByAddress(
          user.address,
          undefined,
          'base',
          this.cfgSrv.get('app.swapMarket'),
          this.cfgSrv.get('app.swapProvider'),
        );
        if (swapCount > 0) hasSwapped = true;
      }

      if (hasSwapped) user = await User.updateById(user.id, { hasSwapped: true });
    }

    if (!req.user) user.desensitize();

    return ok().data(user).build<User>();
  }

  /**
   * Register a device
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/register-device')
  async registerDevice(@Req() req: express.Request) {
    await this.userSrv.registerDevice(req.user);
    return ok().data({ ok: true }).build();
  }

  /**
   * Unregister a device
   * @param req The request object
   * @param body The request body
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Delete('/unregister-device')
  async unregisterDevice(@Req() req: express.Request, @Body(new ValidationPipe(ValPipeOpt)) body: RegisterDeviceDTO) {
    return ok()
      .data({ success: await this.userSrv.unregisterDevice(req.user, body.type) })
      .build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  // @Post('/transfer-scores/:target')
  async transferScores(@Req() req: express.Request, @Param('target') target: string) {
    const user = req.user;
    user.points = parseInt(await Point.getTotalPointsByAddress(user.address));

    const targetUser = await User.getByAddress(target);
    if (!targetUser) throw404('target user not found');

    if (isEqualStr(user.address, target)) {
      return throw400('cannot transfer to self');
    }

    if (!user.telegramBotChatId) {
      return throw400('Only telegram virtual accounts can transfer tap scores');
    }

    await transaction(User, async (User) => {
      if (user.points > 0) {
        await Point.transferToAddress(user.address, target);
      }

      if (toDec(user.tapScore).gt(0)) {
        await User.transferTapScore(user.address, target, toDec(targetUser.tapScore).add(user.tapScore).toFixed());
      }
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Log the online status of a user
   * @param req The request object
   * @param res The response object
   * @param body The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/log-status')
  async logOnlineStatus(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @Body(new ValidationPipe(ValPipeOpt)) body: LogOnlineStatusDTO,
  ) {
    const address = req.user.address;

    // If order ID is provided, make sure the user is involved in the order
    if (body.orderId != undefined) {
      const swap = await Swap.get(body.net, body.orderId, undefined, 'disputes.draftees');
      if (!swap) return ok(res).status(200).data({ ok: false }).build();
      const isInvolved = !Swap.isSwapCounterparty(swap, address) && !Swap.isSwapDraftee(swap, address, true);
      if (isInvolved) return ok(res).status(200).data({ ok: false }).build();
    }

    // If offer ID is provided, make sure the user is involved in the offer
    if (body.offerId != undefined) {
      const offer = await Offer.getByNetworkAndOfferId(body.net, body.offerId);
      if (!offer) return ok(res).status(200).data({ ok: false }).build();
      const isInvolved = offer.isInvolved(address);
      if (!isInvolved) return ok(res).status(200).data({ ok: false }).build();
    }

    await transaction(OnlineStatus, async (OnlineStatus) => {
      await OnlineStatus.delete(body.net, req.user.address, body.orderId, body.offerId);
      await OnlineStatus.create({
        network: body.net,
        address: req.user.address,
        orderId: body.orderId,
        offerId: body.offerId,
      });
    });

    return ok(res).status(201).data({ ok: true }).build();
  }

  /**
   * Get the energon balance of an address
   * @param address The address to check
   * @returns
   * TODO: delete after testnet
   */
  @Get('/energon-balance/:address')
  async getEnergonBalance(@Param('address') address: string) {
    if (isAddress(address) === false) {
      return ok().data({ balance: '0' }).build();
    }

    const balance = await this.netSrv.getContracts('ethereum').energon?.balanceOf(address);
    return ok()
      .data({ balance: toDec(balance).toFixed() })
      .build();
  }

  /**
   * Get information about the NFTs owned by an address
   * @param address The address to check
   * @returns
   * TODO: delete after testnet
   */
  @Get('/nft-info/:address')
  async getNFTOwned(@Param('address') address: string) {
    const nfts = await NFTOwner.findByAddress(address);

    let totalPoints = '0';
    for (const nft of nfts) {
      const pointPerEng = parseFloat(this.cfgSrv.get('app.pointsPerEnergon'));
      const point = toDec(pointPerEng).mul(getTokenEnergonAlloc(nft.tokenId));
      totalPoints = toDec(totalPoints).add(point).toFixed();
    }

    return ok()
      .data({
        count: nfts.length,
        totalPoints,
      })
      .build();
  }

  /**
   * Get the galxe points of an address
   * @param address The address to check
   */
  @Get('/galxe-points/:address')
  async getGalxePoints(@Param('address') address: string) {
    const points = galxePoints as unknown as {
      ['Wallet Address']: string;
      ['Address Type']: string;
      Point: number;
      Ranking: 1;
    }[];

    // Find by address
    const point = points.find((p) => p['Wallet Address'].toLowerCase() === address.toLowerCase());

    let earned = 0;
    if (point) {
      const pointPerGalxe = parseFloat(this.cfgSrv.get('app.pointsPerGalxe'));
      earned = toDec(point.Point).mul(pointPerGalxe).toNumber();
    }

    return ok()
      .data({ points: point?.Point ?? 0, actualPoints: earned })
      .build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Get('/claims/:address')
  async getClaims(@Param('address') address: string) {
    const user = await User.getByAddress(address);

    // Get claims
    let claims = await TokenClaim.findByAddress(address);

    // Remove signature from claims if user has not passed the activation period
    claims = claims.map((c) => {
      if (!user || !user.claimActivatedAt || moment(user.claimActivatedAt).isAfter(moment())) {
        delete c.signature;
      }
      if (!user.hasSwapped && (c.name.startsWith(AllocatorName.DexUser) || c.name.startsWith(AllocatorName.Point))) {
        delete c.signature;
      }
      return c;
    });

    return ok().data(claims).build();
  }

  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/activate-claims')
  async activateClaims(@Req() req: express.Request) {
    const user = req.user;
    if (!user.claimActivatedAt) {
      await User.updateById(user.id, { claimActivatedAt: moment().add(1, 'minutes').toISOString() });
    }
    return ok().data({ ok: true }).build();
  }
}

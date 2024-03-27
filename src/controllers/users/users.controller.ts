import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAddress } from 'ethers';
import express from 'express';
import { transaction } from 'objection';
import { isEqualStr, toDec } from '../../common/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorMessages, ok, throw401, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { MayHaveKeyGuard } from '../../guards/may_have_token.guard';
import { MayBeAuthenticatedGuard } from '../../guards/maybe_authenticated.guard';
import NFTOwner from '../../models/nft_owner';
import Offer from '../../models/offer';
import OnlineStatus from '../../models/online_status';
import Swap from '../../models/swap';
import User from '../../models/user';
import NetworkService from '../../network/network.service';
import { getTokenEnergonAlloc } from '../points/point.service';
import * as galxePoints from './data/glaxe.json';
import { GetQueryDTO, LogOnlineStatusDTO, RegisterDeviceDTO } from './dto';
import { UserService } from './user.service';

@Controller('v1/users')
export class UsersController {
  constructor(private userSrv: UserService, private netSrv: NetworkService, private cfgSrv: ConfigService) {}

  /**
   * Get a user by address. Sensitive user fields are removed
   * if the request does not contain a valid session token.
   * @param req The request object
   * @param address The target user address
   * @param q The query object
   * @param [q.net] The network name
   * @param [q.no404] Return a zero User object if user was not found
   */
  @UseGuards(MayBeAuthenticatedGuard)
  @UseGuards(MayHaveKeyGuard)
  @Get('/:address')
  async get(
    @Req() req: express.Request,
    @Param('address') address: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: GetQueryDTO,
  ) {
    if (req.user && !isEqualStr(req.user.address, address)) {
      throw401(ErrorMessages.NoAuthPermission);
    }

    let user = req.user;
    if (!user) {
      user = await User.getByAddress(address);
      if (!user && !q.no404) throw404(ErrorMessages.UserNotFound);
      if (!user && q.no404) {
        return ok()
          .data({
            address,
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

  /**
   * Log the online status of a user
   * @param req The request object
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
}

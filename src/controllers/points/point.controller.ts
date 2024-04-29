import { Body, Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import { recoverMessageAddress } from 'viem';
import { isEqualStr, toDec } from '../../common/common';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ErrorTypes, ok, throw400 } from '../../common/responses/responses';
import NFTOwner from '../../models/nft_owner';
import Point, { PointAction } from '../../models/point';
import { isZero, pow10 } from '../../network/common';
import NetworkService from '../../network/network.service';
import * as galxePoints from '../users/data/glaxe.json';
import { CreatePointFromEnergonBalance, GetLeaderboardDTO, GetRecentPoints } from './dto';
import { PointService, getTokenEnergonAlloc } from './point.service';

/**
 * PointController handles all point functionalities.
 */
@Controller('v1/points')
export class PointController {
  constructor(private pointSrv: PointService, private netSrv: NetworkService, private cfgSrv: ConfigService) {}

  /**
   * getLeaderboard returns the leaderboard.
   * @param query The query object
   * @param [query.address] The address to get the leaderboard for
   * @param [query.limit] The limit of addresses to get
   * @returns
   */
  @Get('/leaderboard')
  async getLeaderboard(@Query(new ValidationPipe(CommonValidationPipeOpt)) query: GetLeaderboardDTO) {
    const result = await Point.getTopAddresses(parseInt(query.limit) || 100, query.address);
    const countAddresses = await Point.countDistinctAddresses(query.address);

    result.forEach((r) => {
      if (r.owner) {
        r.owner = {
          referrer: r.owner.referrer,
        } as any;
      }
    });

    if (query.address && result.length > 0) {
      const rank = await Point.getRankByAddress(query.address);
      result[0].rank = rank;
    }

    return ok()
      .data({
        total: countAddresses,
        points: result,
      })
      .build();
  }

  /**
   * Converts Energon balance to points.
   * @param body The request body
   * @param body.signer The signer address
   * @param body.beneficiary The beneficiary address
   * @param body.sig The signature
   * @returns
   */
  // @Post('/from-energon-balance')
  async createPointFromEnergonBalance(
    @Body(new ValidationPipe(CommonValidationPipeOpt)) body: CreatePointFromEnergonBalance,
  ) {
    try {
      const address = await recoverMessageAddress({
        message: `beneficiary: ${body.beneficiary}`,
        signature: body.sig as `0x${string}`,
      });

      if (!isEqualStr(address, body.signer)) {
        throw400('invalid signature', ErrorTypes.InvalidRequest);
      }
    } catch (error) {
      throw400('invalid signature', ErrorTypes.InvalidRequest);
    }

    // Check if the point has already been granted
    const pointName = `energon_point:${body.signer}`;
    const existingPoint = await Point.getByName(pointName);
    if (existingPoint) {
      throw400('points already granted', ErrorTypes.InvalidRequest);
    }

    // Get the ENG balance of the signer
    const engBal = await this.netSrv.getContracts('ethereum').energon?.balanceOf(body.signer);

    // Make sure the signer has a non-zero ENG balance
    if (isZero(engBal)) {
      throw400('zero energon balance', ErrorTypes.InvalidRequest);
    }

    // Calculate the points to grant
    const pointPerEng = parseFloat(this.cfgSrv.get('app.pointsPerEnergon'));
    const pointsToGrant = toDec(engBal).div(pow10(18)).mul(pointPerEng).toNumber();
    if (pointsToGrant <= 0) {
      throw400('zero points to grant', ErrorTypes.InvalidRequest);
    }

    // Grant the points
    await Point.create({
      network: 'ethereum',
      name: pointName,
      address: body.beneficiary,
      point: pointsToGrant.toFixed(),
      action: PointAction.Energon,
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Converts NFT ownership to points.
   * @param body The request body
   * @param body.signer The signer address
   * @param body.beneficiary The beneficiary address
   * @param body.sig The signature
   * @returns
   */
  // @Post('/from-nft-owned')
  async createPointFromNFTOwned(
    @Body(new ValidationPipe(CommonValidationPipeOpt)) body: CreatePointFromEnergonBalance,
  ) {
    try {
      const address = await recoverMessageAddress({
        message: `beneficiary: ${body.beneficiary}`,
        signature: body.sig as `0x${string}`,
      });

      if (!isEqualStr(address, body.signer)) {
        throw400('invalid signature', ErrorTypes.InvalidRequest);
      }
    } catch (error) {
      throw400('invalid signature', ErrorTypes.InvalidRequest);
    }

    // Check if the point has already been granted
    const pointName = `nft_owned:${body.signer}`;
    const existingPoint = await Point.getByName(pointName);
    if (existingPoint) {
      throw400('points already granted', ErrorTypes.InvalidRequest);
    }

    // Calculate total points based on NFT owned by signer
    const nfts = await NFTOwner.findByAddress(body.signer);
    let totalPoints = '0';
    for (const nft of nfts) {
      const pointPerEng = parseFloat(this.cfgSrv.get('app.pointsPerEnergon'));
      const point = toDec(pointPerEng).mul(getTokenEnergonAlloc(nft.tokenId));
      totalPoints = toDec(totalPoints).add(point).toFixed();
    }

    // Grant the points
    await Point.create({
      network: 'ethereum',
      name: pointName,
      address: body.beneficiary,
      point: totalPoints,
      action: PointAction.NFTOwnership,
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Converts NFT ownership to points.
   * @param body The request body
   * @param body.signer The signer address
   * @param body.beneficiary The beneficiary address
   * @param body.sig The signature
   * @returns
   */
  // @Post('/from-galxe')
  async createPointFromGalxe(@Body(new ValidationPipe(CommonValidationPipeOpt)) body: CreatePointFromEnergonBalance) {
    try {
      const address = await recoverMessageAddress({
        message: `beneficiary: ${body.beneficiary}`,
        signature: body.sig as `0x${string}`,
      });

      if (!isEqualStr(address, body.signer)) {
        throw400('invalid signature', ErrorTypes.InvalidRequest);
      }
    } catch (error) {
      throw400('invalid signature', ErrorTypes.InvalidRequest);
    }

    // Check if the point has already been granted
    const pointName = `galxe:${body.signer}`;
    const existingPoint = await Point.getByName(pointName);
    if (existingPoint) {
      throw400('points already granted', ErrorTypes.InvalidRequest);
    }

    const points = galxePoints as unknown as {
      ['Wallet Address']: string;
      ['Address Type']: string;
      Point: number;
      Ranking: 1;
    }[];

    // Find by address
    let point = points.find((p) => p['Wallet Address'].toLowerCase() === body.signer.toLocaleLowerCase());
    if (!point) {
      return ok().data({ ok: false }).build();
    }

    point = _.clone(point);

    const pointPerGalxe = parseFloat(this.cfgSrv.get('app.pointsPerGalxe'));
    point.Point = point.Point * pointPerGalxe;

    await Point.create({
      network: 'galxe',
      name: pointName,
      address: body.beneficiary,
      point: point?.Point.toString() || '0',
      action: PointAction.CSV,
    });

    return ok().data({ ok: true }).build();
  }

  /**
   * Check if a point exists by name.
   * @param name The point name
   * @returns
   */
  @Get('/:name/exist')
  async isPointExistByName(@Param('name') name: string) {
    return ok()
      .data({ exist: !!(await Point.getByName(name)) })
      .build();
  }

  /**
   * Get recent points
   * @param query The query object
   * @param [query.from] The date to get points from
   * @param [query.limit] The limit of points to get
   * @param [query.order] The order of the points
   * @returns
   */
  @Get('/latest')
  async getLatestPoints(@Query(new ValidationPipe(CommonValidationPipeOpt)) query: GetRecentPoints) {
    const points = await Point.getPointsAfterDate(query.from, parseInt(query.limit) || 100, query.order);
    return ok().data(points).build();
  }
}

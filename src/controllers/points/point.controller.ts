import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { recoverMessageAddress } from 'viem';
import { isEqualStr, toDec } from '../../common/common';
import { ErrorTypes, ok, throw400 } from '../../common/responses/responses';
import { IsRootAdmin } from '../../guards/is_basic_admin';
import Point, { PointAction } from '../../models/point';
import { pow10D } from '../../network/common';
import NetworkService from '../../network/network.service';
import { CreatePointFromEnergonBalance, CreatePointsFromCSV, GetLeaderboardDTO, GetRecentPoints } from './dto';
import { PointService } from './point.service';

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
  async getLeaderboard(@Query() query: GetLeaderboardDTO) {
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
   * Converts CSV entries to points.
   * @param body The request body
   * @param body.csvUrl The CSV URL
   * @returns
   */
  @UseGuards(IsRootAdmin)
  @Post('/from-csv')
  async createPointsFromCSV(@Body() body: CreatePointsFromCSV) {
    const csvBody = await axios(body.csvUrl).then((res) => res.data);
    await this.pointSrv.grantPointsFromCSV(csvBody);
    return ok().data({ ok: true }).build();
  }

  /**
   * Converts Energon balance to points.
   * @param body The request body
   * @param body.signer The signer address
   * @param body.beneficiary The beneficiary address
   * @param body.sig The signature
   * @returns
   */
  @Post('/from-energon-balance')
  async createPointFromEnergonBalance(@Body() body: CreatePointFromEnergonBalance) {
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
    const engBal = await this.netSrv.getContracts().energon?.balanceOf(body.signer);

    // Make sure the signer has a non-zero ENG balance
    if (engBal.isZero()) {
      throw400('zero energon balance', ErrorTypes.InvalidRequest);
    }

    // Calculate the points to grant
    const pointPerEng = parseFloat(this.cfgSrv.get('app.pointsPerEnergon'));
    const pointsToGrant = toDec(engBal).div(pow10D(18)).mul(pointPerEng).toNumber();
    if (pointsToGrant <= 0) {
      throw400('zero points to grant', ErrorTypes.InvalidRequest);
    }

    // Grant the points
    await Point.create({
      network: this.cfgSrv.get('app.network'),
      name: pointName,
      address: body.beneficiary,
      point: pointsToGrant.toFixed(),
      action: PointAction.Energon,
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
   * @returns
   */
  @Get('/latest')
  async getLatestPoints(@Query() query: GetRecentPoints) {
    const points = await Point.getPointsAfterDate(query.from, parseInt(query.limit) || 100);
    return ok().data(points.reverse()).build();
  }
}

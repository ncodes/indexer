import { Controller, Get, Param, Query } from '@nestjs/common';
import { ErrorMessages, ok, throw404 } from '../../common/responses/responses';
import Point from '../../models/point';
import User from '../../models/user';
import { GetLeaderboardDTO, GetRecentPoints } from './dto';

/**
 * ReferralController handles all referral functionalities.
 */
@Controller('v1/referrals')
export class ReferralController {
  /**
   * Get referrer info for an address
   * @param address The address to get the referrer info for
   */
  @Get('/:address/info')
  async getInfo(@Param('address') address: string) {
    const referrer = await User.getByAddress(address);
    if (!referrer) throw404(ErrorMessages.UserNotFound);
    const totalPoints = await Point.getReferrerTotalPoints(address);
    const referred = await User.getReferred(address, 3);
    return ok()
      .data({
        refCode: referrer.refCode,
        numReferred: await User.countReferred(address),
        totalPoints: totalPoints,
        referred: referred.map((r) => r.address),
      })
      .build();
  }

  /**
   * getLeaderboard returns the leaderboard.
   * @param query The query object
   * @param [query.address] The address to get the leaderboard for
   * @param [query.limit] The limit of addresses to get
   * @returns
   */
  @Get('/leaderboard')
  async getLeaderboard(@Query() query: GetLeaderboardDTO) {
    const result = await Point.getTopRefereesOfReferrer(parseInt(query.limit) || 100, query.referrer, query.referee);
    const countAddresses = await Point.countDistinctRefereesOfReferrer(query.referrer, query.referee);

    result.forEach((r) => {
      if (r.owner) {
        r.owner = {
          referrer: r.owner.referrer,
        } as any;
      }
    });

    if (query.referee && result.length > 0) {
      const rank = await Point.getRankOfReferrersReferee(query.referrer, query.referee);
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
   * Get recent points for a referrer
   * @param query The query object
   * @param [query.referrer] The referrer address to get points for
   * @param [query.from] The date to get points from
   * @param [query.limit] The limit of points to get
   * @returns
   */
  @Get('/latest')
  async getLatestPoints(@Query() query: GetRecentPoints) {
    const points = await Point.getReferrerPointsAfterDate(query.referrer, query.from, parseInt(query.limit) || 100);
    return ok().data(points.reverse()).build();
  }
}

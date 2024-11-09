import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import { toDec } from '../../common/common';
import Point, { PointAction } from '../../models/point';
import User from '../../models/user';
import { Base } from '../base';

/**
 * TapsToPointsJob is responsible for converting users' taps to points.
 * Each tap will be converted to points based on the pointsPerTap config.
 * It should be run before the PointsToMerkleJob.
 */
@Injectable()
export default class TapsToPointsJob extends Base {
  private logger = new Logger(TapsToPointsJob.name);
  pointsPerTap = 2;

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/10 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      const users = await User.findTapUnconverted(100);

      this.logger.log(`Processing tap conversion for ${users.length} users`);

      for (const user of users) {
        const pointName = `activity:tapwar:${user.address}`;
        const existingPoint = await Point.getByName(pointName);
        if (!existingPoint) {
          const pointsToGrant = toDec(user.tapScore).div(this.pointsPerTap);

          if (pointsToGrant.lte(0)) continue;

          await Point.create({
            network: '-',
            name: pointName,
            address: user.address,
            point: pointsToGrant.toFixed(0),
            action: PointAction.Tap,
          });

          this.logger.log(`Granted ${pointsToGrant} points to ${user.address}`);
        }

        await User.updateById(user.id, { tapToPointConvAt: moment().toISOString() });
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

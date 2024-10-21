import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import { toDec } from '../../common/common';
import Point, { PointAction } from '../../models/point';
import User from '../../models/user';
import { Base } from '../base';

@Injectable()
export default class TapToPointConverter extends Base {
  private logger = new Logger(TapToPointConverter.name);

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

      this.logger.log(`Processing tap converstion for ${users.length} users`);

      for (const user of users) {
        const pointName = `activity:tapwar:${user.address}`;
        const existingPoint = await Point.getByName(pointName);
        if (existingPoint) continue;

        const pointsPerTap = parseFloat(this.cfgSrv.get('app.tapoff.pointsPerTap'));
        const pointsToGrant = toDec(user.tapScore).div(pointsPerTap);

        if (pointsToGrant.lte(0)) continue;

        await Point.create({
          network: '-',
          name: pointName,
          address: user.address,
          point: pointsToGrant.toFixed(0),
          action: PointAction.Tap,
        });

        await User.updateById(user.id, { tapToPointConvAt: moment().toISOString() });

        this.logger.log(`Granted ${pointsToGrant} points to ${user.address}`);
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

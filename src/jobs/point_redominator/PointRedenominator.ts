import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { transaction } from 'objection';
import { toDec } from '../../common/common';
import Point from '../../models/point';
import { Base } from '../base';

/**
 * PointRedenominator finds points and redenominates them
 */
@Injectable()
export default class PointRedenominator extends Base {
  private logger = new Logger(PointRedenominator.name);

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/60 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      await transaction(Point, async (Point) => {
        const points = await Point.getNonRedominatedPoints(parseInt(this.cfgSrv.get('app.redenominationLimit')));
        this.logger.log(`Found ${points.length} points to redenominate`);

        for (const point of points) {
          const newPoint = toDec(point.point).div(parseInt(this.cfgSrv.get('app.redenominationRate')));
          await Point.updateById(point.id, {
            point: newPoint.toString(),
            redenominated: true,
          });
        }
      });
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

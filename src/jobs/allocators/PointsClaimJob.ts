import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import { toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import Point from '../../models/point';
import TokenClaim from '../../models/token_claim';
import User from '../../models/user';
import { pow10 } from '../../network/common';
import { Base } from '../base';

/**
 * PointsClaimJob is responsible for creating claim entries point holders.
 */
@Injectable()
export default class PointsClaimJob extends Base {
  private logger = new Logger(PointsClaimJob.name);
  claimId = 1;
  maxPointsForTokenAlloc = 5_000_000;
  tokenPerPoint = 0.1;
  namePrefix = 'point';
  minPoints = 10_000;

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
      const users = await User.findNotAddedToMerkleTree(100);

      this.logger.log(`Processing ${users.length} users point for claim entry creation`);

      for (const user of users) {
        let totalPoints = parseInt(await Point.getTotalPointsByAddress(user.address)) || 0;
        if (totalPoints >= this.minPoints) {
          const name = `${this.namePrefix}:${user.address}`;
          const existingClaim = await TokenClaim.findByName(name);
          if (!existingClaim) {
            totalPoints = Math.min(totalPoints, this.maxPointsForTokenAlloc);
            const tokenAlloc = toDec(this.tokenPerPoint).mul(totalPoints);
            const tokenAllocLd = tokenAlloc.mul(pow10(18)).toFixed(0);

            const signature = await getClaimSig(
              this.cfgSrv.get('app.claimSigner'),
              user.address,
              tokenAllocLd,
              this.claimId,
              0,
            );

            await TokenClaim.create({
              name,
              address: user.address,
              amount: tokenAllocLd,
              claimId: this.claimId,
              signature,
            });
          }
        }

        await User.updateById(user.id, { addedMerkleEntryAt: moment().toISOString() });
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

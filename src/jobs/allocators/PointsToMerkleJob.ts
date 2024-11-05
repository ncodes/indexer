import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import { toDec } from '../../common/common';
import MerkleTree from '../../models/merkle_tree';
import Point from '../../models/point';
import User from '../../models/user';
import { pow10 } from '../../network/common';
import { Base } from '../base';

/**
 * PointsToMerkleJob is responsible for creating the merkle tree entries for users' points.
 * Each user will get their total points converted to allocations and saved in the merkle tree table.
 */
@Injectable()
export default class PointsToMerkleJob extends Base {
  private logger = new Logger(PointsToMerkleJob.name);
  claimId = 0;
  maxPointsForTokenAlloc = 50_000_000;
  tokenPerPoint = 0.01;

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

      this.logger.log(`Processing ${users.length} users for airdrop merkle tree`);

      for (const user of users) {
        let totalPoints = parseInt(await Point.getTotalPointsByAddress(user.address)) || 0;
        if (totalPoints > 0) {
          const existingMerkleEntry = await MerkleTree.findByAddressAndClaimId(user.address, this.claimId);
          if (!existingMerkleEntry) {
            totalPoints = Math.min(totalPoints, this.maxPointsForTokenAlloc);
            const tokenAlloc = toDec(this.tokenPerPoint).mul(totalPoints);
            await MerkleTree.create({
              address: user.address,
              claimId: this.claimId,
              amount: tokenAlloc.mul(pow10(18)).toFixed(0),
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

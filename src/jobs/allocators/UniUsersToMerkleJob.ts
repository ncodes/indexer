import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import MerkleTree from '../../models/merkle_tree';
import UniUser from '../../models/uni_user';
import { Base } from '../base';

/**
 * UniUsersToMerkleJob is responsible for creating the merkle tree entries for the UNI users.
 */
@Injectable()
export default class UniUsersToMerkleJob extends Base {
  private logger = new Logger(UniUsersToMerkleJob.name);
  amountPerUser = '100';
  namePrefix = 'uni_user';
  claimId = 0;

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/10 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      const entries = await UniUser.findAll();
      this.logger.log(`Processing ${entries.length} uni users`);
      let processed = 0;
      for (const entry of entries) {
        const name = `${this.namePrefix}:${entry.address}`;

        try {
          await MerkleTree.create({
            name,
            address: entry.address,
            amount: this.amountPerUser,
            claimId: this.claimId,
          });
        } catch (e) {
          if (e instanceof Error && !e.message.includes('duplicate key value')) {
            throw e;
          }
        }

        processed++;
        this.logger.log(`Processed ${processed} of ${entries.length} uni users`);
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

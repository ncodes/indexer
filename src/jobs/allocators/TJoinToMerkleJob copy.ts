import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import MerkleTree from '../../models/merkle_tree';
import { Base } from '../base';
import * as Data from './tjoin_holders_to_merkle.json';

/**
 * TJoinToMerkleJob is responsible for creating the merkle tree entries for the TJOIN holders.
 * Update tjoin_holders_to_merkle.json to add new entries.
 */
@Injectable()
export default class TJoinToMerkleJob extends Base {
  private logger = new Logger(TJoinToMerkleJob.name);
  namePrefix = 'tjoin_buyer';
  claimId = 1;

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
      this.logger.log(`Processing TJOIN to merkle for ${Data.length} users`);
      for (const entry of Data) {
        const name = `${this.namePrefix}:${entry.address}`;
        const existingMerkleEntry = await MerkleTree.findByName(name);
        if (!existingMerkleEntry) {
          await MerkleTree.create({
            name,
            address: entry.address,
            amount: entry.amountOfJoin,
            claimId: this.claimId,
          });
        }
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

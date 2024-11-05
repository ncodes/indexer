import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { toDec } from '../../common/common';
import MerkleTree from '../../models/merkle_tree';
import { pow10 } from '../../network/common';
import { Base } from '../base';
import * as Data from './kol_to_merkle.json';

/**
 * KOLToMerkleJob is responsible for creating the merkle tree entries for the KOL airdrop.
 * Update kol_to_merkle.json to add new entries.
 */
@Injectable()
export default class KOLToMerkleJob extends Base {
  private logger = new Logger(KOLToMerkleJob.name);
  pricePerTJOIN = 0.01;
  tokenPerTJOIN = 1;
  namePrefix = 'kol';
  claimId = 2;

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
      this.logger.log(`Processing KOL to merkle for ${Data.length} users`);
      for (const entry of Data) {
        const name = `${this.namePrefix}:${entry.address}`;
        const existingMerkleEntry = await MerkleTree.findByName(name);
        if (!existingMerkleEntry) {
          const amount = toDec(entry.amountUsd).div(this.pricePerTJOIN).mul(this.tokenPerTJOIN);
          await MerkleTree.create({
            name,
            address: entry.address,
            amount: amount.mul(pow10(18)).toFixed(0),
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { isProd, toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import TokenClaim from '../../models/token_claim';
import { pow10 } from '../../network/common';
import { Base } from '../base';
import { AllocatorName } from './common';
import * as Data from './kols.json';

/**
 * KOLClaimJob is responsible for creating the claims entries for project KOLs.
 * Update kols.json to add new entries.
 */
@Injectable()
export default class KOLClaimJob extends Base {
  private logger = new Logger(KOLClaimJob.name);
  pricePerTJOIN = 0.005;
  tokenPerTJOIN = 1;
  namePrefix = AllocatorName.KOL;
  claimId = 3;

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
        const existingMerkleEntry = await TokenClaim.findByName(name);
        if (!existingMerkleEntry) {
          const amount = toDec(entry.amountUsd).div(this.pricePerTJOIN).mul(this.tokenPerTJOIN);
          const amtLd = amount.mul(pow10(18)).toFixed(0);

          const signature = await getClaimSig(
            this.cfgSrv.get('app.claimSigner'),
            entry.address,
            amtLd,
            this.claimId,
            0,
            isProd() ? 8453 : 31337,
          );

          await TokenClaim.create({
            name,
            address: entry.address,
            amount: amtLd,
            claimId: this.claimId,
            signature,
          });

          this.logger.log(`Created claim for ${name}`);
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

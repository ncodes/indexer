import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { isProd, toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import TokenClaim from '../../models/token_claim';
import { Base } from '../base';
import * as Data from './tjoin_holders.json';

/**
 * TJoinClaimJob is responsible for creating claim entries for the TJOIN holders.
 * Update tjoin_holders.json to add new entries.
 */
@Injectable()
export default class TJoinClaimJob extends Base {
  private logger = new Logger(TJoinClaimJob.name);
  namePrefix = 'tjoin_buyer';
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
      this.logger.log(`Processing TJOIN to claim entry for ${Data.length} users`);
      for (const entry of Data) {
        const name = `${this.namePrefix}:${entry.address}`;
        const existingMerkleEntry = await TokenClaim.findByName(name);

        if (!existingMerkleEntry) {
          const signature = await getClaimSig(
            this.cfgSrv.get('app.claimSigner'),
            entry.address,
            entry.amountOfJoin,
            this.claimId,
            0,
            isProd() ? 8453 : 31337,
          );

          await TokenClaim.create({
            name,
            address: entry.address,
            amount: toDec(entry.amountOfJoin).toFixed(),
            claimId: this.claimId,
            signature,
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

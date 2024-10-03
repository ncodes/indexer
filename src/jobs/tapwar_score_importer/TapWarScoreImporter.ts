import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import TapService from '../../controllers/airdrop/tap.service';
import User from '../../models/user';
import { Base } from '../base';

/**
 * TapWarScoreImporter imports TapWar scores from redis to user table
 */
@Injectable()
export default class TapWarScoreImporter extends Base {
  private logger = new Logger(TapWarScoreImporter.name);

  constructor(private cfgSrv: ConfigService, private tapSrv: TapService) {
    super();
    this.schedule();
  }

  @Cron(process.env.TAPWAR_SCORE_IMPORT_CRON)
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to process'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      const users = await User.findByNullTapScore(1000);
      this.logger.log(`Importing tap scores for ${users.length} users`);

      for (const user of users) {
        const tapCount = await this.tapSrv.getTapCount(user.address);
        await User.updateById(user.id, { tapScore: tapCount });
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

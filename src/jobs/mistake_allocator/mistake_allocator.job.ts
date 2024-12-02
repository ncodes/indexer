import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import Swap from '../../models/swap';
import User from '../../models/user';
import { Base } from '../base';

/**
 * MistakeAllocator
 */
@Injectable()
export default class MistakeAllocator extends Base {
  private logger = new Logger(MistakeAllocator.name);

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
      const markets = ['0x11877c64e10f4c30FDA7Ef1F4F7cbc77EA178C6d', '0x5A7a18332BB961586791F982BCCC9d6B4A80206e'];

      for (const market of markets) {
        const swaps = await Swap.getByMarketAddress(market);
        this.logger.log(`Found ${swaps.length} mistaken swaps in market ${market}`);

        for (const swap of swaps) {
          const user = await User.getByAddress(swap.taker);
          if (!user.chkForWrongSwapMktAt) {
            await User.updateByAddress(swap.taker, {
              hasSwapped: true,
              chkForWrongSwapMktAt: moment().toISOString(),
            });
            this.logger.log(`Updated user ${swap.taker} for swapping in wrong market`);
          }
        }

        this.logger.log(`Updated done => ${market}`);
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { Base } from '../base';

/**
 * ExchangeRateCacher updates the exchange rate cache
 */
@Injectable()
export default class ExchangeRateCacher extends Base {
  private logger = new Logger(ExchangeRateCacher.name);

  constructor(private exRateSrv: ExchangeRateService) {
    super();
    this.schedule();
  }

  @Cron('*/120 * * * * *')
  schedule() {
    this.process().catch((e) => {
      //
    });
  }

  async process() {
    if (this.isProcessing()) return;
    return new Promise<void>(async (res, rej) => {
      this.setProcessing(true);
      try {
        await this.exRateSrv.updateCache();
        this.logger.log('Exchange Rate Updated');
        return res();
      } catch (e) {
        this.logger.error(e.message || 'failed to get exchange rate');
        return rej(e);
      } finally {
        this.setProcessing(false);
      }
    });
  }
}

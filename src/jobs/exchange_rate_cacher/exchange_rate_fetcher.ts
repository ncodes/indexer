import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { Base } from '../base';

/**
 * ExchangeRateFetcher updates the exchange rate cache
 */
@Injectable()
export default class ExchangeRateFetcher extends Base {
  private logger = new Logger(ExchangeRateFetcher.name);

  constructor(private exRateSrv: ExchangeRateService) {
    super();
    this.schedule();
  }

  @Cron('*/120 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);
    try {
      await this.exRateSrv.updateCache();
      this.logger.log('Exchange Rate Updated');
      return;
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

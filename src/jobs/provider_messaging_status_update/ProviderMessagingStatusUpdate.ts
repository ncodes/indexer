import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Client } from '@xmtp/xmtp-js';
import { Wallet } from 'ethers';
import * as moment from 'moment';
import Liquidity from '../../models/liquidity';
import User from '../../models/user';
import { Base } from '../base';

/**
 * ProviderMessagingStatusUpdate updates the notification status of liquidity providers
 */
@Injectable()
export default class ProviderMessagingStatusUpdate extends Base {
  private logger = new Logger(ProviderMessagingStatusUpdate.name);
  public xmtp: Client;

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/5 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e));
  }

  async process() {
    if (this.isProcessing()) return;
    return new Promise<void>(async (res, rej) => {
      this.setProcessing(true);
      try {
        const liquidities = await Liquidity.getProvidersWithDisabledMessaging(3600);
        this.logger.debug(`found ${liquidities.length} liquidities with disabled messaging`);
        for (const liquidity of liquidities) await this.notify(liquidity);
        return res();
      } catch (e) {
        this.logger.error(e.message || 'failed to records');
        return rej(e);
      } finally {
        this.setProcessing(false);
      }
    });
  }

  /**
   * Check liquidity provider's messaging status and update accordingly
   * @param liquidity The liquidity provider
   */
  async notify(provider: string) {
    if (!this.xmtp) {
      const wallet = Wallet.createRandom();
      this.xmtp = await Client.create(wallet, {
        env: this.cfgSrv.get('app.xmtpEnv'),
      });
    }

    const enabled = await this.xmtp.canMessage(provider);
    await Liquidity.updateByProviderAddress(provider, {
      messagingEnabled: enabled,
      messagingEnabledUpdatedAt: moment().toISOString(),
    });

    await User.updateByAddress(provider, {
      messagingEnabled: enabled,
    });
  }
}

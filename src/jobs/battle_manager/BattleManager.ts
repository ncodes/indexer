import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { transaction } from 'objection';
import { isProd } from '../../common/common';
import Battle from '../../models/battle';
import { RedisService } from '../../services/redis/redis.service';
import { Base } from '../base';

/**
 * BattleManager manages daily battle progress and calculations
 */
@Injectable()
export default class BattleManager extends Base {
  private logger = new Logger(BattleManager.name);

  constructor(private cfgSrv: ConfigService, private redisSrv: RedisService) {
    super();
    this.schedule();
  }

  @Cron(isProd() ? '0 0 * * *' : '*/60 * * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      await transaction(Battle, async (Battle) => {
        const battle = await Battle.create({
          allocation: this.cfgSrv.get('app.tapoff.battleAlloc'),
        });

        await this.redisSrv.set('tapoff:battle:current', battle.id);

        console.log('Battle is coming');
      });
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

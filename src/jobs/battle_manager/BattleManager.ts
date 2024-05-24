import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { transaction } from 'objection';
import { toDec } from '../../common/common';
import Allocation from '../../models/allocations';
import Battle from '../../models/battle';
import BondSpend from '../../models/bond_spend';
import Tap from '../../models/tap';
import { RedisService } from '../../services/redis/redis.service';
import { Base } from '../base';
import TapService from '../../controllers/airdrop/tap.service';

/**
 * BattleManager manages daily battle progress and calculations
 */
@Injectable()
export default class BattleManager extends Base {
  private logger = new Logger(BattleManager.name);

  constructor(private cfgSrv: ConfigService, private tapSrv: TapService) {
    super();
    this.schedule();
  }

  @Cron(process.env.BATTLE_MANAGER_CRON)
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    this.logger.log('Processing battle');

    try {
      const curBattle = await Battle.getLatestBattle();

      // Create new battle
      const allocation = this.cfgSrv.get('app.tapoff.battleAlloc');
      const newBattle = await Battle.create({ allocation });
      await this.tapSrv.updateCurrentBattle(newBattle.id);

      if (!curBattle) return;

      // Process allocation for the previous battle
      return transaction(BondSpend, Allocation, async (BondSpend, Allocation) => {
        // Get percentage of taps for each side
        const totalDroidTaps = await this.tapSrv.getBattlePlayerCount(curBattle.id, 'droid');
        const totalBanditTaps = await this.tapSrv.getBattlePlayerCount(curBattle.id, 'bandit');
        const totalTaps = toDec(totalDroidTaps).add(totalBanditTaps);

        // If no taps, delete all bond spend for this battle
        // effectively returning all bond spend to the users
        if (totalTaps.isZero()) {
          await BondSpend.deleteByBattleId(curBattle.id);
          return;
        }

        const droidTapsPct = toDec(totalDroidTaps).div(totalTaps).mul(100);
        const banditTapsPct = toDec(totalBanditTaps).div(totalTaps).mul(100);

        // Calculate allocation for each side
        const droidSideAlloc = toDec(allocation).mul(droidTapsPct).div(100);
        const banditSideAlloc = toDec(allocation).mul(banditTapsPct).div(100);

        // Get the total stakeScore for each side
        const droidStakeScore = await BondSpend.getTotalStakeScore(curBattle.id, 'droid');
        const banditStakeScore = await BondSpend.getTotalStakeScore(curBattle.id, 'bandit');

        // Get unallocated bond spends
        const unallocated = await BondSpend.getUnallocatedSpend(curBattle);

        for (const spend of unallocated) {
          const sideAlloc = spend.side === 'droid' ? droidSideAlloc : banditSideAlloc;
          const sideStakeScore = spend.side === 'droid' ? droidStakeScore : banditStakeScore;

          // Calculate the percentage of the spend stakeScore in the total stakeScore
          const spendPct = toDec(spend.stakeScore).div(sideStakeScore).mul(100);

          // Calculate the allocation for the spend
          const spendAlloc = sideAlloc.mul(spendPct).div(100);

          // Create the allocation if it doesn't exist
          const allocName = `${curBattle.id}_${spend.id}`;
          const existingAlloc = await Allocation.getByName(allocName);
          if (!existingAlloc) {
            const alloc = await Allocation.create({
              name: allocName,
              owner: spend.userId,
              amount: spendAlloc.mul(10 ** 18).toFixed(0),
            });

            await BondSpend.updateById(spend.id, {
              allocationId: alloc.id,
              sideAllocPct: (spend.side === 'droid' ? droidTapsPct : banditTapsPct).toNumber(),
              allocPct: spendPct.toNumber(),
            });
          }
        }
      });
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}

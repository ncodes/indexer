import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../services/redis/redis.service';
import CacheService from '../../cacher/cache.service';
import { toDec } from '../../common/common';
import * as moment from 'moment';
import Tap from '../../models/tap';
import TapSpend from '../../models/tap_spend';
import { TapSpendType } from './constants';
import MultiplierSpend from '../../models/multiplier_spend';

@Injectable()
export default class TapService {
  logger = new Logger(TapService.name);

  constructor(private redisSrv: RedisService, private cacherSrv: CacheService) {}

  /**
   * Get the user by socket id
   * @param socketId The socket id
   */
  getClientUserId(socketId: string): Promise<string> {
    return this.redisSrv.get(buildClientKey(socketId));
  }

  /**
   * Delete the user id of a client
   * @param socketId The socket id
   */
  deleteClientUserId(socketId: string) {
    return this.redisSrv.delete(buildClientKey(socketId));
  }

  /**
   * Update the user id of a client
   * @param socketId The socket id
   * @param userId The user id
   * @param expireIn The expiration time in seconds
   */
  updateClientUserId(socketId: string, userId: string, expireIn: number) {
    return this.redisSrv.setEx(buildClientKey(socketId), userId, expireIn);
  }

  /**
   * Create a tap spend
   * @param data The tap spend object
   */
  async createTapSpend(data: Partial<TapSpend>) {
    if (!data.createdAt) data.createdAt = moment().toISOString();
    await this.redisSrv.rPush(
      buildTapSpendListKey(data.userId),
      JSON.stringify({
        createdAt: data.createdAt,
        amount: data.amount,
        type: data.type,
      }),
    );
    return data;
  }

  /**
   * Get total tap spends for a user
   * @param userId The user id
   */
  async getTotalTapSpends(userId: string): Promise<string> {
    const spends = await this.getTapSpends(userId);
    let total = toDec(0);
    for (const spend of spends) {
      total = total.add(toDec(spend.amount));
    }
    return total.toFixed();
  }

  /**
   * Count the number of tap spends for a user
   * @param userId The user id
   * @param type The spend type
   */
  async countTapSpends(userId: string, type?: TapSpendType): Promise<number> {
    const spends = await this.getTapSpends(userId);
    let count = 0;
    for (const spend of spends) {
      if (type && type !== spend.type) continue;
      count++;
    }
    return count;
  }

  /**
   * Count the number of tap spends for a user within a period
   * @param userId The user id
   * @param type The spend type
   * @param period The period in seconds
   */
  async countTapSpendsFrom(userId: string, type: string, period: number): Promise<number> {
    const spends = await this.getTapSpends(userId);
    const now = moment();
    let count = 0;
    for (const spend of spends) {
      if (type && type !== spend.type) continue;
      if (now.diff(spend.createdAt, 'seconds') <= period) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get tap spends of a user
   * @param userId The user id
   * @param type The spend type
   */
  async getTapSpends(userId: string, type?: string): Promise<Partial<TapSpend>[]> {
    const spends = await this.redisSrv.lRange(buildTapSpendListKey(userId), 0, -1);

    let tapSpends = spends.map((s) => {
      const spend = JSON.parse(s) as Partial<TapSpend>;
      return type && spend.type !== type ? null : spend;
    });

    tapSpends = tapSpends.filter((s) => s !== null) as Partial<TapSpend>[];

    return tapSpends.sort((a, b) => {
      return moment(a.createdAt).diff(moment(b.createdAt));
    });
  }

  /**
   * Get the last spend of a user
   * @param userId The user id
   * @param type The spend type
   */
  async getLastTapSpend(userId: string, type: string): Promise<Partial<TapSpend> | null> {
    const spends = await this.getTapSpends(userId, type);
    if (spends.length === 0) return null;
    const spend = spends[spends.length - 1];
    if (type && spend.type !== type) return null;
    return spend;
  }

  /**
   * Create a multiplier spend
   * @param spend The multiplier spend object
   */
  async createMultiplierSpend(spend: Partial<MultiplierSpend>) {
    if (!spend.createdAt) spend.createdAt = moment().toISOString();
    await this.redisSrv.rPush(buildUserMultiplierSpendKey(spend.userId), JSON.stringify(spend));
    await this.redisSrv.incrBy(buildUserTotalMultiplierSpendKey(spend.userId), spend.amount);
    await this.redisSrv.incrBy(buildUserTotalMultiplierTapKey(spend.userId), spend.taps);
  }

  /**
   * Get the total multiplier spend of a user
   * @param userId The user id
   */
  async getTotalMultiplierSpend(userId: string): Promise<string> {
    return (await this.redisSrv.get(buildUserTotalMultiplierSpendKey(userId))) || '0';
  }

  /**
   * Get the total multiplier taps of a user
   * @param userId The user id
   */
  async getTotalMultiplierTaps(userId: string): Promise<string> {
    return (await this.redisSrv.get(buildUserTotalMultiplierTapKey(userId))) || '0';
  }

  /**
   * Get the total multiplier spend of a user since a period
   * @param userId The user id
   * @param period The period in seconds
   */
  async getTotalMultiplierSpendFrom(userId: string, period: number): Promise<string> {
    const spendsStr = await this.redisSrv.lRange(buildUserMultiplierSpendKey(userId), 0, -1);
    const spends = spendsStr.map((s) => JSON.parse(s) as Partial<MultiplierSpend>);

    spends.sort((a, b) => {
      return moment(a.createdAt).diff(moment(b.createdAt));
    });

    const now = moment();
    let total = toDec(0);
    for (const spend of spends) {
      if (now.diff(spend.createdAt, 'seconds') <= period) {
        total = total.add(toDec(spend.amount));
      }
    }

    return total.toFixed();
  }

  /**
   * Get the last multiplier spend of a user
   * @param userId The user id
   */
  async getLastMultiplierSpend(userId: string): Promise<Partial<MultiplierSpend> | null> {
    const spendsStr = await this.redisSrv.lRange(buildUserMultiplierSpendKey(userId), -1, -1);
    if (spendsStr.length === 0) return null;
    return JSON.parse(spendsStr[0]) as Partial<MultiplierSpend>;
  }

  /**
   * Get the overheat level of a user
   * @param userId The user id
   * @param overheatLvl The overheat level
   */
  updateUserTapOverheatLevel(userId: string, overheatLvl: bigint) {
    return this.redisSrv.set(buildOverheatKey(userId), overheatLvl.toString());
  }

  /**
   * Get the overheat level of a user
   * @param userId The user id
   */
  getUserTapOverheatLevel(userId: string) {
    return this.redisSrv.get(buildOverheatKey(userId));
  }

  /**
   * Set the last overheat update time of a user
   * @param userId The user id
   * @param unixTime The unix time
   */
  updateUserLastOverheatUpdateTime(userId: string, unixTime: string) {
    return this.redisSrv.set(buildOverheatLastUpdateTimeKey(userId), unixTime);
  }

  /**
   * Get the last overheat update time of a user
   * @param userId The user id
   */
  getUserLastOverheatUpdateTime(userId: string) {
    return this.redisSrv.get(buildOverheatLastUpdateTimeKey(userId));
  }

  /**
   * Set the last overheat update time of a user
   * @param userId The user id
   * @param unixTime The unix time
   */
  updateUserLastTapTime(userId: string, unixTime: string) {
    return this.redisSrv.set(buildUserLastTapTimeKey(userId), unixTime);
  }

  /**
   * Get the last tap time of a user
   * @param userId The user id
   */
  getUserLastTapTime(userId: string) {
    return this.redisSrv.get(buildUserLastTapTimeKey(userId));
  }

  /**
   * Update the current battle Id
   * @param battleId The battle id
   */
  updateCurrentBattle(battleId: string) {
    return this.redisSrv.set(buildCurrentBattleKey(), battleId);
  }

  /**
   * Get the current battle Id
   */
  getCurrentBattle() {
    return this.redisSrv.get(buildCurrentBattleKey());
  }

  /**
   * Get the user battle side
   * @param userId The user id
   * @param battleId The battle id
   */
  getUserBattleSide(userId: string, battleId: string) {
    return this.redisSrv.get(buildUserBattleSideKey(userId, battleId));
  }

  /**
   * Set the user battle side
   * @param userId The user id
   * @param battleId The battle id
   * @param side The side
   */
  setUserBattleSide(userId: string, battleId: string, side: 'droid' | 'bandit') {
    return this.redisSrv.set(buildUserBattleSideKey(userId, battleId), side);
  }

  /**
   * Increment the battle player count of a side
   * @param battleId The battle id
   * @param side The side
   */
  incrBattlePlayerCount(battleId: string, side: 'droid' | 'bandit') {
    return this.redisSrv.incrBy(buildBattleSideCountKey(battleId, side), 1);
  }

  /**
   * Get the battle player count of a side
   * @param battleId The battle id
   * @param side The side
   */
  async getBattlePlayerCount(battleId: string, side: 'droid' | 'bandit') {
    return parseInt((await this.redisSrv.get(buildBattleSideCountKey(battleId, side))) || '0');
  }

  /**
   * Check if a user has a bonus tap
   * @param userId The user id
   * @param bonusName The bonus name
   */
  async hasBonusTap(userId: string, bonusName: string) {
    return this.redisSrv.exist(buildTapBonusNameKey(userId, bonusName));
  }

  /**
   * Create a tap
   * @param tap The tap object
   * @param ignoreActivePlayerUpdate Whether to ignore updating the active players
   */
  async createTap(tap: Partial<Tap>, ignoreActivePlayerUpdate = false) {
    if (!tap.createdAt) tap.createdAt = moment().toISOString();

    if (!tap.bonus) {
      await this.redisSrv.incrBy(buildTotalTapsKey(), 1);
      await this.redisSrv.incrBy(buildTotalNonBonusTapsKey(), 1);
      const now = moment(tap.createdAt);
      await this.redisSrv.zAdd(buildUserTapTimeKey(tap.userId), now.valueOf(), now.valueOf().toString());
    }

    if (tap.bonus) {
      await this.redisSrv.incrBy(buildTapBonusKey(tap.userId), tap.bonusValue);
      await this.redisSrv.set(buildTapBonusNameKey(tap.userId, tap.bonusName), tap.bonusValue.toString());
      await this.redisSrv.incrBy(buildTotalTapsKey(), tap.bonusValue);
    }

    if (tap.battleId) {
      await this.redisSrv.incrBy(buildBattleTapCountKey(tap.battleId, tap.battleSide), tap.bonus ? tap.bonusValue : 1);
    }

    // Add user to the players set
    await this.redisSrv.sAdd(buildTapPlayerSetKey(), tap.userId);

    // Add user to the players set for the day
    const currentStartOfDay = moment().startOf('day').toISOString();
    await this.redisSrv.sAdd(buildTapPlayerCurrentDaySetKey(currentStartOfDay), tap.userId);

    // Update the active players
    if (ignoreActivePlayerUpdate) return;
    const activePlayer = await this.redisSrv.get(buildActivePlayerKey(tap.userId));
    if (!activePlayer) {
      await this.redisSrv.setEx(buildActivePlayerKey(tap.userId), '1', 60);
      await this.redisSrv.zAdd(buildActivePlayersKey(), moment().unix(), tap.userId);
    }
  }

  /**
   * Get the active players in the last minute
   */
  async getActivePlayersInLastMinute() {
    const now = moment().unix();
    const minAgo = moment().subtract(1, 'minute').unix();
    const players = await this.redisSrv.zRevRangeByScore(buildActivePlayersKey(), now, minAgo);
    return (players?.length || 0).toString();
  }

  /**
   * Get user taps per period
   * @param userId The user id
   * @param period The period in seconds
   */
  async getUserTapsPerPeriod(userId: string, period: number) {
    const now = moment();
    const periodAgo = now.clone().subtract(period, 'seconds').valueOf();
    const taps = await this.redisSrv.zRevRangeByScore(buildUserTapTimeKey(userId), now.valueOf(), periodAgo);
    return taps.length;
  }

  /**
   * Get total players
   */
  async getTotalUniquePlayers() {
    return (await this.redisSrv.sCard(buildTapPlayerSetKey())) || '0';
  }

  /**
   * Get players
   */
  async getPlayers() {
    return this.redisSrv.sMembers(buildTapPlayerSetKey());
  }

  /**
   * Get total players for a day
   * @param isoDate The iso date
   */
  async getTotalUniquePlayersForDay(isoDate: string) {
    return this.redisSrv.sCard(buildTapPlayerCurrentDaySetKey(isoDate));
  }

  /**
   * Get the tap count for a battle and an optional side
   * @param battleId The battle id
   * @param battleSide The battle side
   */
  async getBattleTapCount(battleId?: string, battleSide?: 'droid' | 'bandit') {
    if (!battleSide) {
      const totalDroidTaps = parseInt((await this.redisSrv.get(buildBattleTapCountKey(battleId, 'droid'))) || '0');
      const totalBanditTaps = parseInt((await this.redisSrv.get(buildBattleTapCountKey(battleId, 'bandit'))) || '0');
      return totalDroidTaps + totalBanditTaps;
    } else {
      return parseInt((await this.redisSrv.get(buildBattleTapCountKey(battleId, battleSide))) || '0');
    }
  }

  /**
   * Get the total taps of a user that are not bonus
   * @param userId The user id
   */
  async getTotalNonBonusTaps(userId: string): Promise<string> {
    const oldScore = await this.redisSrv.lLen(buildTapKey(userId));
    const newScore = toDec((await this.redisSrv.get(buildTotalNonBonusTapsKey())) || '0');
    return toDec(oldScore).add(newScore).toFixed(0);
  }

  /**
   * Get the total bonus taps of a user
   * @param userId The user id
   */
  async getTotalBonusTaps(userId: string): Promise<string> {
    return (await this.redisSrv.get(buildTapBonusKey(userId))) || '0';
  }

  /**
   * Get the tap count
   * @param userId The user id (optional)
   * @param ignoreSpends Whether to ignore tap spends
   * @param ignoreBonus Whether to ignore bonus taps
   */
  async getTapCount(userId?: string, ignoreSpends?: boolean, ignoreBonus?: boolean): Promise<string> {
    if (userId) {
      let totalSpend = '0';
      if (!ignoreSpends) totalSpend = await this.getTotalTapSpends(userId);
      const totalMultiplierTaps = toDec(await this.getTotalMultiplierTaps(userId)).toDP(0);
      const totalBonusTaps = !ignoreBonus ? await this.getTotalBonusTaps(userId) : '0';
      const totalNonBonusTaps = await this.getTotalNonBonusTaps(userId);
      return toDec(totalNonBonusTaps).add(totalBonusTaps).add(totalMultiplierTaps).sub(totalSpend).toFixed(0);
    } else {
      if (!ignoreBonus) {
        return this.redisSrv.get(buildTotalTapsKey());
      } else {
        return toDec((await this.redisSrv.get(buildTotalNonBonusTapsKey())) || '0').toFixed(0);
      }
    }
  }

  async updatePingLastUpdatedTime(userId: string, unixTime: string) {
    return this.redisSrv.set(buildUserLastPingTimeKey(userId), unixTime);
  }

  async getLastPingUpdateTime(userId: string) {
    return this.redisSrv.get(buildUserLastPingTimeKey(userId));
  }

  /**
   * Mark a for completing follow quest
   * @param userId The user id
   * @param channel The channel
   */
  async markUserfollowQuest(userId: string, channel: string) {
    return this.redisSrv.set(buildUserFollowQuestKey(channel, userId), '1');
  }

  /**
   * Check if a user has marked for completing follow quest
   * @param userId The user id
   * @param channel The channel
   */
  async hasMarkedUserFollowQuest(userId: string, channel: string) {
    return this.redisSrv.exist(buildUserFollowQuestKey(channel, userId));
  }

  /**
   * Set the referral claim count
   * @param userId The user id
   * @param count The count
   */
  async setReferralClaimCount(userId: string, count: number) {
    return this.redisSrv.set(buildReferralClaimCountKey(userId), count.toString());
  }

  /**
   * Get the referral bonus claim count
   * @param userId
   */
  async getReferralClaimCount(userId: string) {
    return this.redisSrv.get(buildReferralClaimCountKey(userId));
  }

  setHasClaimedOldPoints(userId: string) {
    return this.redisSrv.set(buildHasClaimedOldPoints(userId), '1');
  }

  hasClaimedOldPoints(userId: string) {
    return this.redisSrv.exist(buildHasClaimedOldPoints(userId));
  }

  /**
   * Mark a user has having their TPS logged
   * @param userId The user id
   * @param expireSec The expiration time before the next log
   */
  markTPSAsLogged(userId: string, expireSec: number) {
    return this.redisSrv.setEx(buildTPSLogTimeKey(userId), '1', expireSec);
  }

  /**
   * Check if a user has their TPS logged
   * @param userId The user id
   */
  hasTPSLogged(userId: string) {
    return this.redisSrv.exist(buildTPSLogTimeKey(userId));
  }

  /**
   * Set the last time a TapWar reminder was sent
   * @param userId The user id
   * @param unixTime The unix time
   */
  setLastReminderSentTime(userId: string, unixTime: number) {
    return this.redisSrv.set(buildLastReminderSentTime(userId), unixTime.toString());
  }

  /**
   * Get the last time a TapWar reminder was sent
   * @param userId The user id
   */
  async getLastReminderSentTime(userId: string) {
    const val = await this.redisSrv.get(buildLastReminderSentTime(userId));
    return val ? parseInt(val) : 0;
  }
}

function buildLastReminderSentTime(userId: string): string {
  return `tapwar:tap:lastReminderSent:${userId}`;
}

function buildTPSLogTimeKey(userId: string): string {
  return `tapwar:tps:logged:${userId}`;
}

function buildUserTapTimeKey(userId: string): string {
  return `tapwar:tap:time:${userId}`;
}
function buildHasClaimedOldPoints(userId: string): string {
  return `tapwar:tap:claimedOldPoints:${userId}`;
}

function buildReferralClaimCountKey(userId: string): string {
  return `tapwar:tap:referral:claim:${userId}`;
}

function buildUserFollowQuestKey(channel: string, userId: string): string {
  return `tapwar:tap:quest:follow:${channel}:${userId}`;
}

function buildUserLastPingTimeKey(userId: string): string {
  return `tapwar:tap:ping:lastUpdated:${userId}`;
}

function buildClientKey(socketId: string): string {
  return `tapwar:tap:client:${socketId}`;
}

function buildTapSpendListKey(userId: string): string {
  return `tapwar:tap:spend:${userId}`;
}

function buildOverheatKey(userId: string): string {
  return `tapwar:tap:overheat:${userId}`;
}

function buildOverheatLastUpdateTimeKey(userId: string): string {
  return `tapwar:tap:overheat:lastUpdated:${userId}`;
}

function buildUserLastTapTimeKey(userId: string): string {
  return `tapwar:tap:lastUpdated:${userId}`;
}

function buildCurrentBattleKey(): string {
  return `tapwar:tap:battle:current`;
}

function buildTapKey(userId: string): string {
  return `tapwar:tap:user:${userId}`;
}

function buildTapBonusKey(userId: string): string {
  return `tapwar:tap:user:${userId}:bonus`;
}

function buildActivePlayersKey() {
  return `tapwar:tap:activePlayers`;
}

function buildActivePlayerKey(userId: string) {
  return `tapwar:tap:activePlayer:${userId}`;
}

function buildTapBonusNameKey(userId: string, name: string): string {
  return `tapwar:tap:user:${userId}:bonus:${name}`;
}

function buildBattleTapCountKey(battleId: string, battleSide: string): string {
  return `tapwar:tap:battle:${battleId}:${battleSide}`;
}

function buildBattleSideCountKey(battleId: string, battleSide: string): string {
  return `tapwar:tap:battle:${battleId}:${battleSide}`;
}

function buildUserMultiplierSpendKey(userId: string): string {
  return `tapwar:multiplier:spend:${userId}`;
}

function buildUserTotalMultiplierSpendKey(userId: string): string {
  return `tapwar:multiplier:spend:total:${userId}`;
}

function buildUserTotalMultiplierTapKey(userId: string): string {
  return `tapwar:multiplier:tap:total:${userId}`;
}

function buildTapPlayerSetKey() {
  return `tapwar:tap:players`;
}

function buildTapPlayerCurrentDaySetKey(isoDate: string) {
  return `tapwar:tap:players:${isoDate}`;
}

function buildTotalTapsKey(): string {
  return `tapwar:tap:total`;
}

function buildTotalNonBonusTapsKey(): string {
  return `tapwar:tap:total:nonBonus`;
}

function buildUserBattleSideKey(userId: string, battleId: string) {
  return `tapwar:tap:battle:side:${battleId}:user:${userId}`;
}

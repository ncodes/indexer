import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Decimal from 'decimal.js';
import * as moment from 'moment';
import { Server, Socket } from 'socket.io';
import { isProd } from '../../common/common';
import { checkToken } from '../../guards/be_authenticated.guard';
import MultiplierSpend from '../../models/multiplier_spend';
import Swap from '../../models/swap';
import Tap from '../../models/tap';
import TapSpend from '../../models/tap_spend';
import User from '../../models/user';
import { RedisService } from '../../services/redis/redis.service';
import { toDec } from './../../common/common';
import {
  FollowQuestBonus,
  InstantCoolWindow,
  MaxInstantCoolPerWindow,
  MaxRapidFirePerWindow,
  Multiplier,
  MultiplierApplyMaxPerWindow,
  MultiplierApplyWindow,
  MultiplierCost,
  RankInfo,
  RapidFireActiveTime,
  RapidFireWindow,
  ReferralInfo,
  TapSpendLevelCost,
  TapSpendType,
} from './constants';

@WebSocketGateway({ namespace: '/v1/taps', pingTimeout: 30000 })
export default class TapGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  logger = new Logger(TapGateway.name);

  constructor(private cfg: ConfigService, private redisSrv: RedisService) {}

  /**
   * Disconnect the socket after a few seconds
   * @param socket The socket object
   * @param seconds The number of seconds to wait before disconnecting
   */
  disconnectAfter(socket: Socket, seconds: number) {
    setTimeout(() => {
      socket.disconnect(true);
    }, seconds * 1000);
  }

  /**
   * Called when a new connection is made.
   * In production, disconnects the socket
   * if the user is not authenticated within
   * a few seconds.
   * @param socket The socket object
   */
  handleConnection(socket: Socket) {
    if (isProd()) {
      setTimeout(async () => {
        const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
        if (!userId) socket.disconnect(true);
      }, 3000);
    }
  }

  /**
   * Called when a connection is disconnected.
   * @param socket The socket object
   */
  handleDisconnect(socket: Socket) {
    this.redisSrv.delete(`tap:client:${socket.id}`);
  }

  /**
   * Handle authentication. If token is not provided
   * or is invalid, disconnect the client.
   * If the token is valid, store the user id in redis
   * for a few minutes.
   * @param client The socket client
   * @param token The access token string
   * @returns
   */
  async _handleAuth(client: Socket, token?: string) {
    token = token ? token : (client.handshake.query.token as string);
    const authErrMsg = 'auth error: not permitted to perform this action';
    const authErr = new Error(authErrMsg);
    if (!token || token == 'null') {
      client.disconnect(true);
      this.logger.error(authErr);
    } else {
      try {
        const session = await checkToken(this.cfg, token);
        if (!session) {
          client.disconnect(true);
          this.logger.error(authErr);
          return;
        }

        this.redisSrv.setWithExpire(`tap:client:${client.id}`, session.userId, 900);
      } catch (error) {
        client.disconnect(true);
        this.logger.error(authErr);
      }
    }
  }

  /**
   * Handle the auth event
   * @param socket The socket object
   * @param token The access token
   */
  @SubscribeMessage('auth')
  async handleAuth(@ConnectedSocket() socket: Socket, @MessageBody('token') token: string) {
    this._handleAuth(socket, token);
    return { success: true };
  }

  /**
   * Handle the tap event
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('tap')
  async handleTap(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const user = await User.getById(userId);

    // Get the user's tap overheat level. If it has not been set, create it
    let overheatLvl = BigInt(0);
    const overheatLvlStr = await this.redisSrv.get(`tap:overheat:${userId}`);
    if (!overheatLvlStr) {
      overheatLvl = await this.getMaxOverheatLevel(userId);
      await this.redisSrv.set(`tap:overheat:${userId}`, overheatLvl.toString());
    } else {
      overheatLvl = BigInt(overheatLvlStr);
    }

    // Number of taps to create
    let tapIncrement = await this.getTapIncrement(userId);

    // Check if user has overheated (overheatLvl <= 0), return error if true.
    // If the user has not overheated, but the tapCount is greater than the overheatLvl,
    // set tapCount to overheatLvl (to prevent overheat but allow the user to tap the remaining amount)
    if (overheatLvl - tapIncrement <= 0) {
      if (overheatLvl <= 0) {
        return { success: false, message: 'You are overheating' };
      } else {
        tapIncrement = overheatLvl;
      }
    }

    // Create a tap record
    const now = moment();
    for (let i = 0; i < tapIncrement; i++) {
      Tap.create({
        userId,
        virtual: i > 0,
        battleId: user.curBattleId,
        battleSide: user.battleSide,
      });
    }

    // Check if rapid fire is active
    const lastRapidFire = await TapSpend.getLastSpend(userId, TapSpendType.RapidFire);
    const rapidFireOn = !lastRapidFire ? false : moment().diff(lastRapidFire.createdAt, 's') < RapidFireActiveTime;

    // Only update new overheat level if rapid fire is not active
    let newOverheatLvl = 0n;
    if (!rapidFireOn) {
      newOverheatLvl = overheatLvl - tapIncrement;
      await this.redisSrv.set(`tap:overheat:${userId}`, newOverheatLvl.toString());
    } else {
      newOverheatLvl = overheatLvl;
    }

    // Update the last overheat updated time
    const overheatLastUpdated = now.unix();
    await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, overheatLastUpdated.toString());

    // Update last tap time
    await this.redisSrv.set(`tap:lastUpdated:${userId}`, now.unix().toString());

    // Update battle status
    this.updateBattleState(user);

    return {
      success: true,
      overheatLvl: newOverheatLvl,
      overheatLastUpdated,
      tapCount: await Tap.getTapCount(userId),
      tapIncrement,
    };
  }

  async updateBattleState(user: User) {
    const curBattleId = await this.redisSrv.get('tapoff:battle:current');
    if (curBattleId) {
      if (user.curBattleId != curBattleId) {
        const countDroidSide = await User.countBattleSide(curBattleId, 'droid');
        const countBanditSide = await User.countBattleSide(curBattleId, 'bandit');
        await User.updateById(user.id, {
          curBattleId,
          battleSide: countDroidSide > countBanditSide ? 'bandit' : 'droid',
        });
      }
    }
  }

  /**
   * Handle the ping event
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('ping')
  async handleOverheatPing(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const now = moment();

    // Make sure at least 1 second has passed since the last ping time
    const lastPingAt = await this.redisSrv.get(`tap:ping:lastUpdated:${userId}`);
    if (lastPingAt && now.unix() - parseInt(lastPingAt) < 1) {
      return { success: false, message: 'Ping cooldown required' };
    }

    // Record last ping time
    await this.redisSrv.set(`tap:ping:lastUpdated:${userId}`, now.unix().toString());

    // Get last overheat level and last tap time
    let overheatLvl = await this.redisSrv.get(`tap:overheat:${userId}`);
    const lastTapAt = await this.redisSrv.get(`tap:lastUpdated:${userId}`);

    // User is a new player, set initial overheat level and
    // last overheat updated time and return
    if (!lastTapAt) {
      const newUserOverheatLevel = await this.getMaxOverheatLevel(userId);
      await this.redisSrv.set(`tap:overheat:${userId}`, newUserOverheatLevel.toString());
      await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, now.unix().toString());
    } else {
      // Compute new overheat level
      const lastOverheatUpdate = await this.redisSrv.get(`tap:overheat:lastUpdated:${userId}`);

      // If the difference between the last updated time
      // if the last tap time is more than 1 second ago (cool down).
      // Increment the overheat level by the number of seconds since the last tap or ping.
      if (now.unix() - parseInt(lastTapAt) > 1) {
        let increment = await this.getCoolingIncrement(userId);

        if (parseInt(lastTapAt) == parseInt(lastOverheatUpdate)) {
          increment = Math.max(now.unix() - parseInt(lastTapAt) - 1, Number(increment));
        }

        let newOverheatLvl = BigInt(increment) + BigInt(overheatLvl);

        const maxOverheatLvl = await this.getMaxOverheatLevel(userId);
        if (newOverheatLvl > maxOverheatLvl) {
          newOverheatLvl = maxOverheatLvl;
        }

        if (BigInt(overheatLvl) != newOverheatLvl) {
          overheatLvl = newOverheatLvl.toString();
          await this.redisSrv.set(`tap:overheat:${userId}`, newOverheatLvl.toString());
          await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, now.unix().toString());
        }
      } else {
        return { success: false, message: 'Tap cooldown required' };
      }
    }

    return {
      success: true,
      lastTapAt: parseInt(lastTapAt),
      overheatLvl: parseInt(overheatLvl),
      overheatLastUpdated: now.unix(),
    };
  }

  /**
   * Handle the countTaps event
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('countTaps')
  async countTaps(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    return { success: true, count: await Tap.getTapCount(userId) };
  }

  /**
   * Handle the info event
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('info')
  async handleInfo(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const user = await User.getById(userId);

    // General info
    const maxOverheatLvl = await this.getMaxOverheatLevel(userId);
    const tapCount = await Tap.getTapCount(userId);
    const tapCountWithoutSpend = await Tap.getTapCount(userId, true);
    const rank = this.getRank(toDec(tapCountWithoutSpend));

    // HyperFire boost info
    const hyperFireLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperFire)) + 1;
    const hyperFireCost = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel]?.cost;
    const hyperFireIncrement = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel]?.increment;
    const hyperFireNextLevelCost = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel + 1]?.cost;
    const hyperFireNextLevelIncrement = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel + 1]?.increment;

    // AntiOverheat boost info
    const antiOverheatLevel = (await TapSpend.countSpend(userId, TapSpendType.AntiOverheat)) + 1;
    const antiOverheatCost = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel]?.cost;
    const antiOverheatIncrement = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel + 1]?.increment;
    const antiOverheatNextLevelCost = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel + 1]?.cost;
    const antiOverheatNextLevelIncrement =
      TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel + 1]?.increment;

    // AntiOverheat boost info
    const hyperCoolLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperCool)) + 1;
    const hyperCoolCost = TapSpendLevelCost[TapSpendType.HyperCool][hyperCoolLevel]?.cost;
    const hyperCoolIncrement = TapSpendLevelCost[TapSpendType.HyperCool][hyperCoolLevel]?.increment;
    const hyperCoolNextLevelCost = TapSpendLevelCost[TapSpendType.HyperCool][hyperCoolLevel + 1]?.cost;
    const hyperCoolNextLevelIncrement = TapSpendLevelCost[TapSpendType.HyperCool][hyperCoolLevel + 1]?.increment;

    // RapidFire boost info
    const numRapidFireUsed = await TapSpend.countSpendFrom(userId, TapSpendType.RapidFire, RapidFireWindow);
    const lastRapidFire = await TapSpend.getLastSpend(userId, TapSpendType.RapidFire);
    const rapidFireOn = !lastRapidFire ? false : moment().diff(lastRapidFire.createdAt, 's') < RapidFireActiveTime;

    // InstantCool boost info
    const numInstantCoolUsed = await TapSpend.countSpendFrom(userId, TapSpendType.InstantCool, InstantCoolWindow);
    const lastInstantCool = await TapSpend.getLastSpend(userId, TapSpendType.InstantCool);

    // Multiplier info
    const multiplierBal = await this.getMultiplierBalance(userId);
    const curWindowSpend = await MultiplierSpend.getTotalSpendFrom(userId, MultiplierApplyWindow);
    const lastMultiplierSpend = await MultiplierSpend.getLastSpend(userId);

    const markedTwitterFollow = (await this.redisSrv.get(`tap:quest:follow:x:${userId}`)) == '1';
    const markedTelegramFollow = (await this.redisSrv.get(`tap:quest:follow:telegram:${userId}`)) == '1';
    const markedWebVisitFollow = (await this.redisSrv.get(`tap:quest:follow:webvisit:${userId}`)) == '1';

    const followQuestCompleted =
      markedTwitterFollow && markedTelegramFollow && markedWebVisitFollow && !!user.discordId;
    const followQuestBonus = await Tap.getByBonusNameAndUser('follow_quests', userId);
    const followQuestReward = FollowQuestBonus.toString();

    const rankBonusClaimStatus = {
      Cadet: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Cadet`, userId)),
      Ensign: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Ensign`, userId)),
      'Lieutenant Jnr': !!(await Tap.getByBonusNameAndUser(`rank_bonus_Lieutenant Jnr`, userId)),
      Lieutenant: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Lieutenant`, userId)),
      Commander: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Commander`, userId)),
      Captain: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Captain`, userId)),
      Commodore: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Commodore`, userId)),
      'Rear Admiral': !!(await Tap.getByBonusNameAndUser(`rank_bonus_Rear Admiral`, userId)),
      'Vice Admiral': !!(await Tap.getByBonusNameAndUser(`rank_bonus_Vice Admiral`, userId)),
      Admiral: !!(await Tap.getByBonusNameAndUser(`rank_bonus_Admiral`, userId)),
    };

    const totalClaims = await this.redisSrv.get(`tap:referral:claims:${userId}`);
    const numReferred = await User.countReferred(user.address);
    const claimableReferrals = numReferred - parseInt(totalClaims || '0');

    const gameStats = {
      totalBalance: await Tap.getTapCount(),
      totalShots: await Tap.count(),
      totalPlayers: await Tap.countTotalUniqueUsers(),
      totalPlayersLast24h: await Tap.countUniqueUsersFrom(86400),
      totalPlayersLast1min: await Tap.countUniqueUsersFrom(60),
    };

    return {
      success: true,
      maxOverheatLvl: Number(maxOverheatLvl),
      tapCount: tapCount,
      tapIncrement: await this.getTapIncrement(userId),
      rank,
      isDiscordConnected: !!user.discordId,
      markedTwitterFollow,
      markedTelegramFollow,
      markedWebVisitFollow,
      followQuestReward: followQuestReward as string,
      followQuestCompleted,
      followQuestBonusAwarded: !!followQuestBonus,
      rankInfo: RankInfo,
      rankBonusClaimStatus,
      referralInfo: ReferralInfo,
      claimableReferrals,
      gameStats,
      rapidFire: {
        active: rapidFireOn,
        numUsed: numRapidFireUsed,
        maxPerWindow: MaxRapidFirePerWindow,
        lastUsedAt: lastRapidFire?.createdAt,
        windowDur: RapidFireWindow,
      },
      instantCool: {
        numUsed: numInstantCoolUsed,
        maxPerWindow: MaxInstantCoolPerWindow,
        lastUsedAt: lastInstantCool?.createdAt,
        windowDur: InstantCoolWindow,
      },
      hyperFire: {
        level: hyperFireLevel,
        cost: hyperFireCost,
        increment: hyperFireIncrement,
        nextLevelCost: hyperFireNextLevelCost,
        nextLevelIncrement: hyperFireNextLevelIncrement,
      },
      antiOverheat: {
        level: antiOverheatLevel,
        cost: antiOverheatCost,
        increment: antiOverheatIncrement,
        nextLevelCost: antiOverheatNextLevelCost,
        nextLevelIncrement: antiOverheatNextLevelIncrement,
      },
      hyperCool: {
        level: hyperCoolLevel,
        cost: hyperCoolCost,
        increment: hyperCoolIncrement,
        nextLevelCost: hyperCoolNextLevelCost,
        nextLevelIncrement: hyperCoolNextLevelIncrement,
      },
      multiplier: {
        balance: multiplierBal,
        cost: MultiplierCost,
        value: Multiplier,
        canSpend: multiplierBal != '0' && toDec(curWindowSpend).lt(MultiplierApplyMaxPerWindow),
        curWindowEndsAt:
          (lastMultiplierSpend &&
            moment(lastMultiplierSpend.createdAt).add(MultiplierApplyWindow, 's').toISOString()) ||
          undefined,
      },
    };
  }

  /**
   * Handle the HyperFire boost purchase request
   * @param socket The socket object
   */
  @SubscribeMessage('buyHyperFire')
  async handleBuyHyperFire(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const currentLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperFire)) + 1;
    const curentTapCount = await Tap.getTapCount(userId);
    const nextLevelCost = TapSpendLevelCost[TapSpendType.HyperFire][currentLevel + 1]?.cost;
    if (!nextLevelCost) {
      return { success: false, message: 'Maximum level reached' };
    }

    if (toDec(curentTapCount).lt(nextLevelCost)) {
      return { success: false, message: 'Insufficient taps' };
    }

    await TapSpend.create({
      userId,
      type: TapSpendType.HyperFire,
      amount: nextLevelCost,
    });

    return {
      success: true,
      message: 'HyperFire boost purchased',
      currentLevel: currentLevel + 1,
    };
  }

  /**
   * Handle RapidFire boost request
   * @param socket The socket object
   */
  @SubscribeMessage('applyRapidFire')
  async handleApplyRapidFire(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    // Count number of rapid fire spends within the last 12 hours
    const numRapidFireUsed = await TapSpend.countSpendFrom(userId, TapSpendType.RapidFire, RapidFireWindow);
    if (numRapidFireUsed >= MaxRapidFirePerWindow) {
      return { success: false, message: 'Maximum reached' };
    }

    const rapidFireSpend = await TapSpend.create({
      userId,
      type: TapSpendType.RapidFire,
      amount: '0',
    });

    return {
      success: true,
      message: 'RapidFire boost applied',
      usedRapidFire: numRapidFireUsed,
      maxRapidFirePerWindow: MaxRapidFirePerWindow,
      lastRapidFireAt: rapidFireSpend.createdAt,
      rapidFireWindow: RapidFireWindow,
    };
  }

  /**
   * Handlle InstantCool boost request
   * @param socket The socket object
   */
  @SubscribeMessage('applyInstantCool')
  async handleApplyInstantCool(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    // Count number of instant cool spends within the last 12 hours
    const numInstantCoolUsed = await TapSpend.countSpendFrom(userId, TapSpendType.InstantCool, InstantCoolWindow);
    if (numInstantCoolUsed >= MaxInstantCoolPerWindow) {
      return { success: false, message: 'Maximum reached' };
    }

    const instantCoolSpend = await TapSpend.create({
      userId,
      type: TapSpendType.InstantCool,
      amount: '0',
    });

    // Update overheat level to max
    const newOverheatLvl = await this.getMaxOverheatLevel(userId);
    await this.redisSrv.set(`tap:overheat:${userId}`, newOverheatLvl.toString());
    await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, moment().unix().toString());

    return {
      success: true,
      message: 'InstantCool boost applied',
      usedInstantCool: numInstantCoolUsed,
      maxInstantCoolPerWindow: MaxRapidFirePerWindow,
      lastInstantCoolAt: instantCoolSpend.createdAt,
      instantCoolWindow: InstantCoolWindow,
    };
  }

  /**
   * * Apply a specific amount of multiplier
   * @param socket The socket object
   * @param amount The amount of multiplier to apply
   * @returns
   */
  @SubscribeMessage('applyMultiplier')
  async handleApplyMultiplier(@ConnectedSocket() socket: Socket, @MessageBody('amount') amount: string) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    if (!amount || toDec(amount).lte(0)) {
      return { success: false, message: 'Invalid amount' };
    } else if (toDec(amount).lte(1)) {
      return { success: false, message: 'Amount too low' };
    }

    const multiplierBal = await this.getMultiplierBalance(userId);

    // Make sure the user has enough multiplier balance
    if (toDec(multiplierBal).lt(amount)) {
      return { success: false, message: 'Insufficient balance' };
    }

    // Make sure the spend limit hasn't been reached
    const curWindowSpend = await MultiplierSpend.getTotalSpendFrom(userId, MultiplierApplyWindow);
    if (toDec(curWindowSpend).gte(MultiplierApplyMaxPerWindow)) {
      return { success: false, message: 'Spend limit reached' };
    }

    // Create a multiplier spend record
    const curTaps = await Tap.getTapCount(userId);
    await MultiplierSpend.create({
      userId,
      amount,
      taps: toDec(curTaps).mul(amount).sub(curTaps).toFixed(),
    });

    return {
      success: true,
      message: 'Multiplier boost applied',
      newBalance: await this.getMultiplierBalance(userId),
    };
  }

  /**
   * Handle the AntiOverheat boost purchase request
   * @param socket The socket object
   */
  @SubscribeMessage('buyAntiOverheat')
  async handleBuyAntiOverheat(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const curentTapCount = await Tap.getTapCount(userId);
    const currentLevel = (await TapSpend.countSpend(userId, TapSpendType.AntiOverheat)) + 1;
    const nextLevelCost = TapSpendLevelCost[TapSpendType.AntiOverheat][currentLevel + 1]?.cost;
    if (!nextLevelCost) {
      return { success: false, message: 'Maximum level reached' };
    }

    if (toDec(curentTapCount).lt(nextLevelCost)) {
      return { success: false, message: 'Insufficient taps' };
    }

    await TapSpend.create({
      userId,
      type: TapSpendType.AntiOverheat,
      amount: nextLevelCost,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });

    // Reset the overheat level to the new level
    const newMaxOverheatLvl = await this.getMaxOverheatLevel(userId);
    await this.redisSrv.set(`tap:overheat:${userId}`, newMaxOverheatLvl.toString());
    await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, moment().unix().toString());

    return {
      success: true,
      message: 'AntiOverheat boost purchased',
      currentLevel: currentLevel + 1,
    };
  }

  /**
   * Handle the HyperCool boost purchase request
   * @param socket The socket object
   */
  @SubscribeMessage('buyHyperCool')
  async handleBuyHyperCool(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const curentTapCount = await Tap.getTapCount(userId);
    const currentLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperCool)) + 1;
    const nextLevelCost = TapSpendLevelCost[TapSpendType.HyperCool][currentLevel + 1]?.cost;
    if (!nextLevelCost) {
      return { success: false, message: 'Maximum level reached' };
    }

    if (toDec(curentTapCount).lt(nextLevelCost)) {
      return { success: false, message: 'Insufficient taps' };
    }

    await TapSpend.create({
      userId,
      type: TapSpendType.HyperCool,
      amount: nextLevelCost,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });

    return {
      success: true,
      message: 'HyperCoolant boost purchased',
      currentLevel: currentLevel + 1,
    };
  }

  /**
   * Handle to mark 'follow' quest
   * @param socket
   * @returns
   */
  @SubscribeMessage('markFollows')
  async handleMarkFollows(
    @ConnectedSocket() socket: Socket,
    @MessageBody('x') x: boolean,
    @MessageBody('telegram') telegram: boolean,
    @MessageBody('webvisit') webvisit: boolean,
  ) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    if (x) {
      this.redisSrv.set(`tap:quest:follow:x:${userId}`, '1');
    }

    if (telegram) {
      this.redisSrv.set(`tap:quest:follow:telegram:${userId}`, '1');
    }

    if (webvisit) {
      this.redisSrv.set(`tap:quest:follow:webvisit:${userId}`, '1');
    }

    return {
      success: true,
      message: 'Follows marked',
    };
  }

  /**
   * Handle the claimQuestsReward event
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('claimQuestsReward')
  async handleClaimQuestsReward(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const user = await User.getById(userId);

    const markedTwitterFollow = (await this.redisSrv.get(`tap:quest:follow:x:${userId}`)) == '1';
    const markedTelegramFollow = (await this.redisSrv.get(`tap:quest:follow:telegram:${userId}`)) == '1';
    const markedWebVisitFollow = (await this.redisSrv.get(`tap:quest:follow:webvisit:${userId}`)) == '1';

    if (!markedTwitterFollow || !markedTelegramFollow || !markedWebVisitFollow || !user.discordId) {
      return { success: false, message: 'Quests not completed' };
    }

    const existingBonus = await Tap.getByBonusNameAndUser('follow_quests', userId);
    if (existingBonus) {
      return { success: true, message: 'Quests reward already claimed' };
    }

    const reward = FollowQuestBonus.toString();
    await Tap.create({
      userId,
      bonus: true,
      bonusValue: reward,
      bonusName: 'follow_quests',
      battleId: user.battleSide,
      battleSide: user.battleSide,
    });

    return {
      success: true,
      message: 'Quests reward claimed',
    };
  }

  /**
   * Claim rank bonus
   * @param socket The socket object
   * @param rank The rank to claim bonus for
   * @returns
   */
  @SubscribeMessage('claimRankBonus')
  async handleClaimRankBonus(@ConnectedSocket() socket: Socket, @MessageBody('rank') rank: string) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const existingBonus = await Tap.getByBonusNameAndUser(`rank_bonus_${rank}`, userId);
    if (existingBonus) {
      return { success: true, message: 'Rank bonus already claimed' };
    }

    const user = await User.getById(userId);

    await Tap.create({
      userId,
      bonus: true,
      bonusValue: RankInfo[rank].reward,
      bonusName: `rank_bonus_${rank}`,
      battleId: user.battleSide,
      battleSide: user.battleSide,
    });

    return {
      success: true,
      message: 'Rank bonus claimed',
    };
  }

  /**
   * Claim bonus for referring a certain number of users
   * @param socket The socket object
   * @param count The number of users to request bonus for
   * @returns
   */
  @SubscribeMessage('claimReferralBonus')
  async handleClaimReferralBonus(@ConnectedSocket() socket: Socket, @MessageBody('count') count: number) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    const refInfo = ReferralInfo.find((info) => info.count == count);
    if (!refInfo) {
      return { success: false, message: 'Invalid referral count' };
    }

    // Total referred user claims
    let totalClaims = await this.redisSrv.get(`tap:referral:claims:${userId}`);
    if (!totalClaims) {
      totalClaims = '0';
    }

    // Make sure the user has enough referrals
    const user = await User.getById(userId);
    const numReferred = await User.countReferred(user.address);
    const claimable = numReferred - parseInt(totalClaims);
    if (claimable < count) {
      return { success: false, message: 'Insufficient referrals' };
    }

    // Mark the claim
    await this.redisSrv.set(`tap:referral:claims:${userId}`, (parseInt(totalClaims) + count).toString());

    // Create the bonus record
    await Tap.create({
      userId,
      bonus: true,
      bonusValue: refInfo.reward.toString(),
      bonusName: `referral_bonus_${count}`,
      battleId: user.battleSide,
      battleSide: user.battleSide,
    });

    return {
      success: true,
      message: 'Referral bonus claimed',
    };
  }

  /**
   * Get the total multiplier balance for a user
   * @param userId The user ID
   * @returns 0 if user does not exist, otherwise the total multiplier balance
   */
  async getMultiplierBalance(userId: string) {
    const user = await User.getById(userId);
    if (!user) return '0';

    const totalMultipliers = await Swap.getTotalAmountByMarketProviderTaker(
      this.cfg.get('app.tapoff.multiplierMarket'),
      this.cfg.get('app.tapoff.multiplierProvider'),
      user.address,
    );

    return toDec(totalMultipliers)
      .div(1e18)
      .sub(await MultiplierSpend.getTotalSpend(userId))
      .toFixed();
  }

  getRank(taps: Decimal) {
    let rank = 'Cadet';

    for (const [key, value] of Object.entries(RankInfo)) {
      if (taps.gte(value.taps)) {
        rank = key;
      }
    }

    return rank;
  }

  /**
   * Get the tap increment for a user
   * @param userId The user ID
   * @returns
   */
  async getTapIncrement(userId: string) {
    const baseLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperFire][1]?.increment);
    const curLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperFire)) + 1;
    const curLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperFire][curLevel]?.increment);

    let incr = baseLevelIncr;

    // Apply level increment
    if (curLevel > 1) incr += curLevelIncr;

    // Apply rapid fire increment
    const lastRapidFire = await TapSpend.getLastSpend(userId, TapSpendType.RapidFire);
    const rapidFireOn = !lastRapidFire ? false : moment().diff(lastRapidFire.createdAt, 's') < RapidFireActiveTime;
    if (rapidFireOn) incr *= 5n;

    return incr;
  }

  /**
   * Get the maximum overheat level for a user
   * @param userId The user ID
   * @returns
   */
  async getMaxOverheatLevel(userId: string) {
    const baseLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.AntiOverheat][1]?.increment);
    const curLevel = (await TapSpend.countSpend(userId, TapSpendType.AntiOverheat)) + 1;
    const curLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.AntiOverheat][curLevel]?.increment);
    if (curLevel > 1) return baseLevelIncr + curLevelIncr;
    return baseLevelIncr;
  }

  /**
   * Get the increment to use for going back to max overheat level (cooling)
   * @param userId The user ID
   * @returns
   */
  async getCoolingIncrement(userId: string) {
    const baseLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperCool][1]?.increment);
    const curLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperCool)) + 1;
    const curLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperCool][curLevel]?.increment);
    if (curLevel > 1) return baseLevelIncr + curLevelIncr;
    return Number(baseLevelIncr);
  }
}

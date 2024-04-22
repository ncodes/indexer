import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Decimal from 'decimal.js';
import * as moment from 'moment';
import { Server, Socket } from 'socket.io';
import { isProd } from '../../common/common';
import { checkToken } from '../../guards/be_authenticated.guard';
import Tap from '../../models/tap';
import TapSpend from '../../models/tap_spend';
import { RedisService } from '../../services/redis/redis.service';
import { toDec } from './../../common/common';
import { TapSpendLevelCost, TapSpendType } from './constants';

@WebSocketGateway({ namespace: '/v1/taps', pingTimeout: 30000 })
export default class TapGateway implements OnGatewayConnection {
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
      this.disconnectAfter(socket, 1);
      return { success: false, message: 'Not authenticated' };
    }

    // Get the user's tap overheat level. If it has not been set, create it
    let overheatLvl = BigInt((await this.redisSrv.get(`tap:overheat:${userId}`)) || '0');
    if (!overheatLvl) {
      overheatLvl = await this.getMaxOverheatLevel(userId);
      await this.redisSrv.set(`tap:overheat:${userId}`, overheatLvl.toString());
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
      await Tap.create({
        userId,
        virtual: i > 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    // Update the overheat level and last update time
    const newOverheatLvl = overheatLvl - tapIncrement;
    await this.redisSrv.set(`tap:overheat:${userId}`, newOverheatLvl.toString());
    const overheatLastUpdated = now.unix();
    await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, overheatLastUpdated.toString());

    // Update last tap time
    await this.redisSrv.set(`tap:lastUpdated:${userId}`, now.unix().toString());

    return {
      success: true,
      overheatLvl: newOverheatLvl,
      overheatLastUpdated,
      tapCount: await Tap.getTapCount(userId),
      tapIncrement,
    };
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
      this.disconnectAfter(socket, 1);
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
          increment = now.unix() - parseInt(lastTapAt) - 1;
        }

        let newOverheatLvl = BigInt(increment) + BigInt(overheatLvl);

        const maxOverheatLvl = await this.getMaxOverheatLevel(userId);
        if (newOverheatLvl > maxOverheatLvl) {
          newOverheatLvl = maxOverheatLvl;
        }

        overheatLvl = newOverheatLvl.toString();
        await this.redisSrv.set(`tap:overheat:${userId}`, newOverheatLvl.toString());
        await this.redisSrv.set(`tap:overheat:lastUpdated:${userId}`, now.unix().toString());
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
      this.disconnectAfter(socket, 1);
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
      this.disconnectAfter(socket, 1);
      return { success: false, message: 'Not authenticated' };
    }

    const maxOverheatLvl = await this.getMaxOverheatLevel(userId);
    const tapCount = await Tap.getTapCount(userId);
    const rank = this.getRank(toDec(tapCount));

    return {
      success: true,
      maxOverheatLvl: Number(maxOverheatLvl),
      tapCount: tapCount,
      tapIncrement: await this.getTapIncrement(userId),
      rank,
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
      this.disconnectAfter(socket, 1);
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
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });

    return {
      success: true,
      message: 'HyperFire boost purchased',
      currentLevel: currentLevel + 1,
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
      this.disconnectAfter(socket, 1);
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
   * Handle the HyperCoolant boost purchase request
   * @param socket The socket object
   */
  @SubscribeMessage('buyHyperCoolant')
  async handleBuyHyperCoolant(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      this.disconnectAfter(socket, 1);
      return { success: false, message: 'Not authenticated' };
    }

    const curentTapCount = await Tap.getTapCount(userId);
    const currentLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperCoolant)) + 1;
    const nextLevelCost = TapSpendLevelCost[TapSpendType.HyperCoolant][currentLevel + 1]?.cost;
    if (!nextLevelCost) {
      return { success: false, message: 'Maximum level reached' };
    }

    if (toDec(curentTapCount).lt(nextLevelCost)) {
      return { success: false, message: 'Insufficient taps' };
    }

    await TapSpend.create({
      userId,
      type: TapSpendType.HyperCoolant,
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
   * Handle boost info request
   * @param socket The socket object
   * @returns
   */
  @SubscribeMessage('getBoostInfo')
  async getBoostInfo(@ConnectedSocket() socket: Socket) {
    const userId = await this.redisSrv.get(`tap:client:${socket.id}`);
    if (!userId) {
      this.disconnectAfter(socket, 1);
      return { success: false, message: 'Not authenticated' };
    }

    // HyperFire boost info
    const hyperFireLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperFire)) + 1;
    const hyperFireCost = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel]?.cost;
    const hyperFireIncrement = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel]?.increment;
    const hyperFireNextLevelCost = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel + 1].cost;
    const hyperFireNextLevelIncrement = TapSpendLevelCost[TapSpendType.HyperFire][hyperFireLevel + 1].increment;

    // AntiOverheat boost info
    const antiOverheatLevel = (await TapSpend.countSpend(userId, TapSpendType.AntiOverheat)) + 1;
    const antiOverheatCost = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel]?.cost;
    const antiOverheatIncrement = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel]?.increment;
    const antiOverheatNextLevelCost = TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel + 1]?.cost;
    const antiOverheatNextLevelIncrement =
      TapSpendLevelCost[TapSpendType.AntiOverheat][antiOverheatLevel + 1]?.increment;

    return {
      success: true,
      hyperFire: {
        level: hyperFireLevel,
        cost: hyperFireCost,
        increment: hyperFireIncrement + 1,
        nextLevelCost: hyperFireNextLevelCost,
        nextLevelIncrement: hyperFireNextLevelIncrement + 1,
      },
      antiOverheat: {
        level: antiOverheatLevel,
        cost: antiOverheatCost,
        increment: antiOverheatIncrement,
        nextLevelCost: antiOverheatNextLevelCost,
        nextLevelIncrement: antiOverheatNextLevelIncrement,
      },
    };
  }

  getRank(tapCount: Decimal) {
    let rank = 'Cadet';
    if (tapCount.gte(2000)) rank = 'Ensign';
    if (tapCount.gte(5000)) rank = 'Lieutenant Jnr';
    if (tapCount.gte(50000)) rank = 'Lieutenant';
    if (tapCount.gte(250000)) rank = 'Commander';
    if (tapCount.gte(500000)) rank = 'Captain';
    if (tapCount.gte(1000000)) rank = 'Commodore';
    if (tapCount.gte(2500000)) rank = 'Rear Admiral';
    if (tapCount.gte(5000000)) rank = 'Vice Admiral';
    if (tapCount.gte(10000000)) rank = 'Admiral';
    if (tapCount.gte(50000000)) rank = 'Fleet Admiral';
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
    if (curLevelIncr) return baseLevelIncr + curLevelIncr;
    return baseLevelIncr;
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
    const baseLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperCoolant][1]?.increment);
    const curLevel = (await TapSpend.countSpend(userId, TapSpendType.HyperCoolant)) + 1;
    const curLevelIncr = BigInt(TapSpendLevelCost[TapSpendType.HyperCoolant][curLevel]?.increment);
    if (curLevel > 1) return baseLevelIncr + curLevelIncr;
    return Number(baseLevelIncr);
  }
}

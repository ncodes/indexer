import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../services/redis/redis.service';
import User from '../models/user';

function buildUserKey(address: string) {
  return `user:${address}`;
}

function buildUserIdUserKey(userId: string) {
  return `user:userId:${userId}`;
}

@Injectable()
export default class CacheService {
  logger = new Logger(CacheService.name);

  constructor(private redisSrv: RedisService) {}

  /**
   * Cache a user
   * @param user The user to cache
   */
  async cacheUser(user: User) {
    if (!user) return;
    await this.redisSrv.set(buildUserKey(user.address), JSON.stringify(user));
    await this.redisSrv.set(buildUserIdUserKey(user.id), user.address);
  }

  /**
   * Get a user from cache by address
   * @param address The address of the user
   */
  async getUserByAddress(address: string): Promise<User | null> {
    const user = await this.redisSrv.get(buildUserKey(address));
    if (!user) {
      return null;
    }
    return JSON.parse(user);
  }

  /**
   * Get a user from cache by userId
   * @param userId The userId of the user
   */
  async getUserByUserId(userId: string): Promise<User | null> {
    const address = await this.redisSrv.get(buildUserIdUserKey(userId));
    if (!address) {
      return null;
    }
    return this.getUserByAddress(address);
  }
}

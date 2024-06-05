import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock, { RedlockAbortSignal } from 'redlock';

@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private client: Redis;
  private redlock: Redlock;

  constructor(private cfg: ConfigService) {
    this.client = new Redis(cfg.get('app.redis.url'), {
      enableReadyCheck: true,
    });

    this.client.on('error', (e) => {
      this.logger.error('Failed to connect to redis', e.message);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis connected');
      this.redlock = new Redlock([this.client], {
        driftFactor: 0.01,
        retryCount: 10,
        retryDelay: 200,
        retryJitter: 200,
        automaticExtensionThreshold: 500,
      });
    });
  }

  async close() {
    await this.client.quit();
  }

  /**
   * Get a key
   * @param key The target key
   */
  async get(key: string): Promise<string> {
    return await this.client.get(key);
  }

  /**
   * Set a key
   * @param key The target key
   * @param value The value stored with the key.
   */
  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  /**
   * setEx sets a key that expires
   * @param key The target key
   * @param value The value stored with the key.
   * @param expireSec The number of second to keep to key around
   */
  async setEx(key: string, value: string, expireSec: number): Promise<void> {
    await this.client.setex(key, expireSec, value);
  }

  /**
   * zAdd adds a member to a sorted set
   * @param key The name of the sorted set
   * @param score The score of the member
   * @param member The member to add
   */
  async zAdd(key: string, score: number, member: string) {
    return this.client.zadd(key, score, member);
  }

  /**
   * zRevRangeByScore gets a range of members from a sorted set from highest to lowest
   * @param key The name of the sorted set
   * @param start The minimum score
   * @param stop The maximum score
   */
  async zRevRangeByScore(key: string, start: number | string, stop: number | string) {
    return this.client.zrevrangebyscore(key, start, stop);
  }

  /**
   * zRemRangeByScore removes a range of members from a sorted set
   * @param key The name of the sorted set
   * @param start The minimum score
   * @param stop The maximum score
   */
  async zRemRangeByScore(key: string, start: number | string, stop: number | string) {
    return this.client.zremrangebyscore(key, start, stop);
  }

  /**
   * delete deletes a key
   * @param key The target key
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * exist checks if a key exists
   * @param key The target key
   */
  async exist(key: string): Promise<boolean> {
    const ex = await this.client.exists(key);
    return ex === 1;
  }

  /**
   * rPush pushes a value to the tail of a list
   * @param key The name of the list
   * @param value The value to push
   */
  async rPush(key: string, value: string): Promise<void> {
    await this.client.rpush(key, value);
  }

  /**
   * lRange gets a range of values from a list
   * @param key The name of the list
   * @param start The start index
   * @param end The end index
   */
  async lRange(key: string, start: number, end: number): Promise<string[]> {
    return this.client.lrange(key, start, end);
  }

  /**
   * incrBy increments a key by a value
   * @param key The target key
   * @param incr The value to increment by
   */
  async incrBy(key: string, incr: number | string): Promise<number> {
    return this.client.incrby(key, incr);
  }

  /**
   * lLen gets the length of a list
   * @param key The name of the list
   */
  async lLen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  /**
   * lPop pops a value from the head of a list
   * @param key The name of the list
   */
  async lPop(key: string): Promise<string> {
    return this.client.lpop(key);
  }

  /**
   * sAdd adds a value to a set
   * @param key The name of the set
   * @param value The value to add
   */
  async sAdd(key: string, value: string): Promise<number> {
    return this.client.sadd(key, value);
  }

  /**
   * sCard gets the cardinality of a set
   * @param key The name of the set
   */
  async sCard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  /**
   * sMembers gets all the members of a set
   * @param key The name of the set
   */
  async sMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Lock a resource
   * @param resources The resources to lock
   * @param duration The duration to lock the resources for
   * @param routine The routine to run while the resources are locked
   * @returns
   */
  async lock(resources: string[], duration: number, routine: (signal: RedlockAbortSignal) => Promise<void>) {
    return this.redlock.using(resources, duration, routine);
  }
}

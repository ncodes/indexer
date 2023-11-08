import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private cfg: ConfigService) {
    this.client = new Redis(cfg.get('app.redis.url'), {
      enableReadyCheck: true,
    });

    this.client.on('error', (e) => {
      this.logger.error('Failed to connect to redis', e.message);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis connected');
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
    const res = await this.client.get(key);
    return res;
  }

  /**
   * setWithExpire sets a key that expires
   * @param key The target key
   * @param value The value stored with the key.
   * @param expireSec The number of second to keep to key around
   */
  async setWithExpire(key: string, value: string, expireSec: number): Promise<void> {
    await this.client.setex(key, expireSec, value);
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
   * lPop pops a value from the head of a list
   * @param key The name of the list
   */
  async lPop(key: string): Promise<string> {
    return this.client.lpop(key);
  }
}

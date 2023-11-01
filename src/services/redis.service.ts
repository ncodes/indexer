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
    return new Promise((res, rej) => {
      this.client
        .get(key)
        .then((val) => {
          return res(val);
        })
        .catch(rej);
    });
  }

  /**
   * setWithExpire sets a key that expires
   * @param key The target key
   * @param value The value stored with the key.
   * @param expireSec The number of second to keep to key around
   */
  setWithExpire(key: string, value: string, expireSec: number): Promise<void> {
    return new Promise((res, rej) => {
      this.client
        .setex(key, expireSec, value)
        .then(() => {
          return res();
        })
        .catch(rej);
    });
  }

  /**
   * delete deletes a key
   * @param key The target key
   */
  delete(key: string): Promise<void> {
    return new Promise((res, rej) => {
      this.client
        .del(key)
        .then(() => {
          res();
        })
        .catch(rej);
    });
  }

  /**
   * exist checks if a key exists
   * @param key The target key
   */
  exist(key: string): Promise<boolean> {
    return new Promise(async (res, rej) => {
      this.client
        .exists(key)
        .then((ex) => {
          return res(ex === 1);
        })
        .catch(rej);
    });
  }
}

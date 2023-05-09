import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redis from 'redis';
import { isDevMode, isLocal } from '../common/common';

@Injectable()
export class RedisService {
  private logger = new Logger(RedisService.name);
  private client: redis.RedisClientType;

  constructor(private cfg: ConfigService) {
    const opt = {
      url: cfg.get('app.redis.url'),
      tls: { rejectUnauthorized: false },
    };
    if (isLocal() || isDevMode()) delete opt.tls;
    this.client = redis.createClient(opt);
    this.client.on('error', (e) => {
      this.logger.error('Failed to connect to redis', e.message);
    });
  }

  close() {
    this.client.quit();
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
        .setEx(key, expireSec, value)
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
    return new Promise((res, rej) => {
      this.client.exists(key).then((ex) => {
        return res(ex === 1);
      });
    });
  }
}

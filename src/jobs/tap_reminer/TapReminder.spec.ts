import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import CacheService from '../../cacher/cache.service';
import { NoopLogger } from '../../common/loggers/noop_logger';
import TapService from '../../controllers/airdrop/tap.service';
import { DBService } from '../../db/db.service';
import { RedisService } from '../../services/redis/redis.service';
import TapReminder from './TapReminder';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockRedisGet, set: mockRedisSet };
});

describe('TapReminder', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, TapReminder, RedisService, CacheService, TapService],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    await app.init();

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  describe('.process', () => {
    //
  });
});

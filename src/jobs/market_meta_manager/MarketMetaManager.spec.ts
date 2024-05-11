import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import User from '../../models/user';
import { RedisService } from '../../services/redis/redis.service';
import MarketMetaManager from './MarketMetaManager';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockRedisGet, set: mockRedisSet };
});

describe('MarketMetaManager', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: MarketMetaManager;
  const cfg = {};
  let u: User;

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
      providers: [ConfigService, MarketMetaManager, RedisService],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<MarketMetaManager>(MarketMetaManager);
    await app.init();

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  beforeEach(async () => {
    u = await User.create({ id: 'user1' });
  });

  describe('.process', () => {
    it('should return undefined if job is already processing', async () => {
      job.setProcessing(true);
      await expect(job.process()).resolves.toBeUndefined();
    });
  });
});

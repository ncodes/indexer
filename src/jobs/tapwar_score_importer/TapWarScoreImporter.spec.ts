import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import CacheService from '../../cacher/cache.service';
import { NoopLogger } from '../../common/loggers/noop_logger';
import TapService from '../../controllers/airdrop/tap.service';
import { DBService } from '../../db/db.service';
import User from '../../models/user';
import { RedisService } from '../../services/redis/redis.service';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockRedisGet, set: mockRedisSet };
});

describe('TapWarScoreImporter', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: TapWarScoreImporter;
  const cfg = {};
  let u: User;
  let u2: User;
  let u3: User;

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
      providers: [ConfigService, TapWarScoreImporter, RedisService, CacheService, TapService],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<TapWarScoreImporter>(TapWarScoreImporter);
    await app.init();

    cfg['app.tapoff.battleAlloc'] = '1000';

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  beforeEach(async () => {
    u = await User.create({ id: 'user1' });
    u2 = await User.create({ id: 'user2' });
    u3 = await User.create({ id: 'user3' });
  });

  describe('.process', () => {
    // it('should return undefined if job is already processing', async () => {
    //   job.setProcessing(true);
    //   await expect(job.process()).resolves.toBeUndefined();
    // });
  });
});

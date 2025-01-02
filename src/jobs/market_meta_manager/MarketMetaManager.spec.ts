import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import User from '../../models/user';
import { MetadataService } from '../../services/metadata/metadata.service';
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
      providers: [ConfigService, MarketMetaManager, RedisService, MetadataService],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(MetadataService)
      .useValue(new (jest.fn())())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    await app.init();

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  beforeEach(async () => {
    await User.create({ id: 'user1' });
  });

  describe('.process', () => {
    it('should have a test', () => {
      // TODO
    });
  });
});

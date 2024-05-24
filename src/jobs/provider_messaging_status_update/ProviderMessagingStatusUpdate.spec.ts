import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Liquidity from '../../models/liquidity';
import User from '../../models/user';
import ProviderMessagingStatusUpdate from './ProviderMessagingStatusUpdate';
import CacheService from '../../cacher/cache.service';
import { RedisService } from '../../services/redis/redis.service';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockRedisGet = jest.fn();
const RedisMock = jest.fn().mockImplementation(() => {
  return {
    set: jest.fn(),
    get: mockRedisGet,
  };
});

describe('OnRevealPeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: ProviderMessagingStatusUpdate;

  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    MockNotifierService.mockClear();
    mockNotify.mockReset();
    await db.truncateTables();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, ProviderMessagingStatusUpdate, RedisService, CacheService],
    })
      .overrideProvider(RedisService)
      .useValue(new RedisMock())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    srv = app.get<ProviderMessagingStatusUpdate>(ProviderMessagingStatusUpdate);
    await app.init();

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  describe('.process', () => {
    it('should return undefined if srv is already processing', async () => {
      srv.setProcessing(true);
      await expect(srv.process()).resolves.toBeUndefined();
    });

    it('should correctly process expected records', async () => {
      let user = await User.create({
        address: '0xProvider',
      });
      let liq = await Liquidity.create({
        provider: '0xProvider',
        messagingEnabled: false,
      });
      let liq2 = await Liquidity.create({
        provider: '0xProvider',
        messagingEnabled: false,
      });
      let liq3 = await Liquidity.create({
        provider: '0xProvider2',
        messagingEnabled: false,
      });

      let liq4 = await Liquidity.create({
        provider: '0xProvider3',
        messagingEnabled: false,
        messagingEnabledUpdatedAt: moment().toISOString(),
      });

      srv.xmtp = {
        canMessage: jest.fn().mockResolvedValue(true),
      } as any;

      await expect(srv.process()).resolves.toBeUndefined();

      liq = await Liquidity.getById(liq.id);
      expect(liq.messagingEnabled).toBe(true);
      expect(liq.messagingEnabledUpdatedAt).toBeDefined();

      liq2 = await Liquidity.getById(liq2.id);
      expect(liq2.messagingEnabled).toBe(true);
      expect(liq2.messagingEnabledUpdatedAt).toBeDefined();

      liq3 = await Liquidity.getById(liq3.id);
      expect(liq3.messagingEnabled).toBe(true);
      expect(liq3.messagingEnabledUpdatedAt).toBeDefined();

      liq4 = await Liquidity.getById(liq4.id);
      expect(liq4.messagingEnabled).toBe(false);

      user = await User.getById(user.id);
      expect(user.messagingEnabled).toBe(true);
    });
  });
});

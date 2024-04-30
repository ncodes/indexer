import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import User from '../../models/user';
import { RedisService } from '../../services/redis/redis.service';
import { makeSession } from '../auth/utils';
import TapGateway from './tap.gateway';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockRedisGet = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return {
    get: mockRedisGet,
  };
});

describe('AirdropController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};
  let cnt: TapGateway;

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCfgGet.mockReset();
    mockRedisGet.mockReset();

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [],
      providers: [ConfigService, RedisService, TapGateway],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    cnt = module.get<TapGateway>(TapGateway);
  });

  let u: User, u2: User, u3: User;
  let token: string, token2: string, token3: string;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address: '0xAddress' });
    u2 = await User.create({ role: Roles.User, address: '0xAddress2' });
    u3 = await User.create({ role: Roles.User, address: '0xAddress3' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
    token2 = await makeSession(u2, randStr(), '5', mockCfgGet('auth.jwtSecret'));
    token3 = await makeSession(u3, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.updateBattleState', () => {
    it('should do nothing when no current battle', async () => {
      mockRedisGet.mockResolvedValue(undefined);
      await expect(cnt.updateBattleState(u)).resolves.toBeUndefined();
      expect(mockRedisGet).toBeCalledTimes(1);
      const user = await User.getById(u.id);
      expect(user.curBattleId).toBeNull();
    });

    it('should update users battle and assign a battle side', async () => {
      mockRedisGet.mockResolvedValue('battle123');

      await expect(cnt.updateBattleState(u)).resolves.toBeUndefined();
      expect(mockRedisGet).toBeCalledTimes(1);
      let user = await User.getById(u.id);
      expect(user.curBattleId).toEqual('battle123');
      expect(user.battleSide).toEqual('droid');

      // user 2
      await expect(cnt.updateBattleState(u2)).resolves.toBeUndefined();
      user = await User.getById(u2.id);
      expect(user.curBattleId).toEqual('battle123');
      expect(user.battleSide).toEqual('bandit');

      // user 3
      await expect(cnt.updateBattleState(u3)).resolves.toBeUndefined();
      user = await User.getById(u3.id);
      expect(user.curBattleId).toEqual('battle123');
      expect(user.battleSide).toEqual('droid');

      // new battle
      mockRedisGet.mockResolvedValue('battleXYZ');
      await expect(cnt.updateBattleState(u)).resolves.toBeUndefined();
      user = await User.getById(u.id);
      expect(user.curBattleId).toEqual('battleXYZ');
      expect(user.battleSide).toEqual('droid');
    });
  });
});

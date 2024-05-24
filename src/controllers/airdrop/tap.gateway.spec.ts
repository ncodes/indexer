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
import CacheService from '../../cacher/cache.service';
import TapService from './tap.service';

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
      providers: [ConfigService, RedisService, TapGateway, CacheService, TapService],
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
    it('should do nothing when user has a battle side', async () => {
      const mockGetCurBattle = jest.spyOn(app.get(TapService), 'getCurrentBattle');
      await expect(cnt.updateBattleState(u.id, 'battle_123', 'droid')).resolves.toBeUndefined();
      expect(mockGetCurBattle).toBeCalledTimes(0);
    });

    describe('when user does not have a battle side', () => {
      it('should update users battle and assign a battle side', async () => {
        const mockGetCurBattle = jest.spyOn(app.get(TapService), 'getCurrentBattle').mockResolvedValue('battle_123');

        const mockGetBattlePlayerCount = jest
          .spyOn(app.get(TapService), 'getBattlePlayerCount')
          .mockImplementation((_battleId: string, _side: 'droid' | 'bandit'): Promise<number> => {
            return Promise.resolve(0);
          });

        const mockIncrBattlePlayerCount = jest
          .spyOn(app.get(TapService), 'incrBattlePlayerCount')
          .mockResolvedValue(undefined);
        const mockSetUserBattleSide = jest.spyOn(app.get(TapService), 'setUserBattleSide').mockResolvedValue(undefined);

        await expect(cnt.updateBattleState(u.id, 'battle_123', '')).resolves.toBeUndefined();
        expect(mockGetCurBattle).toBeCalledTimes(1);
        expect(mockGetBattlePlayerCount).toBeCalledTimes(2);
        expect(mockIncrBattlePlayerCount).toBeCalledWith('battle_123', 'droid');
        expect(mockSetUserBattleSide).toBeCalledWith(u.id, 'battle_123', 'droid');

        // user 2
        mockGetBattlePlayerCount.mockImplementation((battleId: string, side: 'droid' | 'bandit'): Promise<number> => {
          if (side === 'droid') return Promise.resolve(1);
          return Promise.resolve(0);
        });
        mockGetCurBattle.mockClear();
        mockGetBattlePlayerCount.mockClear();
        mockIncrBattlePlayerCount.mockClear();
        mockSetUserBattleSide.mockClear();

        await expect(cnt.updateBattleState(u.id, 'battle_123', '')).resolves.toBeUndefined();
        expect(mockGetCurBattle).toBeCalledTimes(1);
        expect(mockGetBattlePlayerCount).toBeCalledTimes(2);
        expect(mockIncrBattlePlayerCount).toBeCalledWith('battle_123', 'bandit');
        expect(mockSetUserBattleSide).toBeCalledWith(u.id, 'battle_123', 'bandit');

        // user 3
        mockGetBattlePlayerCount.mockImplementation((battleId: string, side: 'droid' | 'bandit'): Promise<number> => {
          if (side === 'droid') return Promise.resolve(1);
          return Promise.resolve(1);
        });

        mockGetCurBattle.mockClear();
        mockGetBattlePlayerCount.mockClear();
        mockIncrBattlePlayerCount.mockClear();
        mockSetUserBattleSide.mockClear();

        await expect(cnt.updateBattleState(u.id, 'battle_123', '')).resolves.toBeUndefined();
        expect(mockGetCurBattle).toBeCalledTimes(1);
        expect(mockGetBattlePlayerCount).toBeCalledTimes(2);
        expect(mockIncrBattlePlayerCount).toBeCalledWith('battle_123', 'droid');
        expect(mockSetUserBattleSide).toBeCalledWith(u.id, 'battle_123', 'droid');
      });
    });
  });
});

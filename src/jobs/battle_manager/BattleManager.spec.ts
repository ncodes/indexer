import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Allocation from '../../models/allocations';
import Battle from '../../models/battle';
import BondSpend from '../../models/bond_spend';
import Tap from '../../models/tap';
import User from '../../models/user';
import { powOf } from '../../network/common';
import { RedisService } from '../../services/redis/redis.service';
import BattleManager from './BattleManager';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockRedisGet, set: mockRedisSet };
});

describe('BattleManager', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: BattleManager;
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
      providers: [ConfigService, BattleManager, RedisService],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<BattleManager>(BattleManager);
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
    it('should return undefined if job is already processing', async () => {
      job.setProcessing(true);
      await expect(job.process()).resolves.toBeUndefined();
    });

    it('should create new battle', async () => {
      await expect(job.process()).resolves.toBeUndefined();
      const battle = await Battle.getLatestBattle();
      expect(battle).toBeDefined();
      expect(battle.allocation).toBe('1000');
    });

    it('should create correct allocations when equal taps for both battle sides and equal bond spend for bond holders on both sides', async () => {
      const battle = await Battle.create({ allocation: '1000' });

      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });

      await BondSpend.create({
        userId: u.id,
        battleId: battle.id,
        side: 'droid',
        amount: '10',
      });

      await BondSpend.create({
        userId: u2.id,
        battleId: battle.id,
        side: 'bandit',
        amount: '10',
      });

      await expect(job.process()).resolves.toBeUndefined();

      const allocs = await Allocation.query().where({ name: battle.id });
      expect(allocs).toHaveLength(2);
      expect(allocs[0].owner).toBe(u.id);
      expect(allocs[0].amount).toEqual(powOf(500, 18).toString());
      expect(allocs[1].owner).toBe(u2.id);
      expect(allocs[1].amount).toEqual(powOf(500, 18).toString());

      const bondSpends = await BondSpend.query().where({ battleId: battle.id });
      expect(bondSpends).toHaveLength(2);
      expect(bondSpends[0].allocationId).toBe(allocs[0].id);
      expect(bondSpends[1].allocationId).toBe(allocs[1].id);
    });

    it('should create correct allocations when one side has more taps and equal bond spend for bond holders on both sides', async () => {
      const battle = await Battle.create({ allocation: '1000' });

      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });

      await BondSpend.create({
        userId: u.id,
        battleId: battle.id,
        side: 'droid',
        amount: '10',
      });

      await BondSpend.create({
        userId: u2.id,
        battleId: battle.id,
        side: 'bandit',
        amount: '10',
      });

      await expect(job.process()).resolves.toBeUndefined();

      const allocs = await Allocation.query().where({ name: battle.id });
      expect(allocs).toHaveLength(2);
      expect(allocs[0].owner).toBe(u.id);
      expect(allocs[0].amount).toEqual(powOf(400, 18).toString());
      expect(allocs[1].owner).toBe(u2.id);
      expect(allocs[1].amount).toEqual(powOf(600, 18).toString());

      const bondSpends = await BondSpend.query().where({ battleId: battle.id });
      expect(bondSpends).toHaveLength(2);
      expect(bondSpends[0].allocationId).toBe(allocs[0].id);
      expect(bondSpends[1].allocationId).toBe(allocs[1].id);
    });

    it('should create correct allocations when one side has more taps and non-equal bond spend for bond holders on both sides', async () => {
      const battle = await Battle.create({ allocation: '1000' });

      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'droid' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });
      await Tap.create({ battleId: battle.id, battleSide: 'bandit' });

      const now = moment();

      await BondSpend.create({
        userId: u.id,
        battleId: battle.id,
        side: 'droid',
        amount: '10',
        createdAt: now.toISOString(),
      });

      await BondSpend.create({
        userId: u2.id,
        battleId: battle.id,
        side: 'bandit',
        amount: '10',
        createdAt: now.toISOString(),
      });

      await BondSpend.create({
        userId: u3.id,
        battleId: battle.id,
        side: 'bandit',
        amount: '10',
        createdAt: now.toISOString(),
      });

      await expect(job.process()).resolves.toBeUndefined();

      const allocs = await Allocation.query().where({ name: battle.id });
      expect(allocs).toHaveLength(3);
      expect(allocs[0].owner).toBe(u.id);
      expect(allocs[0].amount).toEqual(powOf(400, 18).toString());
      expect(allocs[1].owner).toBe(u2.id);
      expect(allocs[1].amount).toEqual(powOf(300, 18).toString());
      expect(allocs[2].owner).toBe(u3.id);
      expect(allocs[2].amount).toEqual(powOf(300, 18).toString());

      const bondSpends = await BondSpend.query().where({ battleId: battle.id });
      expect(bondSpends).toHaveLength(3);
      expect(bondSpends[0].allocationId).toBe(allocs[0].id);
      expect(bondSpends[1].allocationId).toBe(allocs[1].id);
      expect(bondSpends[2].allocationId).toBe(allocs[2].id);
    });
  });
});

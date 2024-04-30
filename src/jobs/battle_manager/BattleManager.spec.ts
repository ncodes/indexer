import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import BattleManager from './BattleManager';

describe('BattleManager', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: BattleManager;
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
      providers: [ConfigService, BattleManager],
    }).compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<BattleManager>(BattleManager);
    await app.init();

    cfg['app.redenominationLimit'] = '1';
    cfg['app.redenominationRate'] = '10000';

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  describe('.process', () => {
    it('should return undefined if job is already processing', async () => {
      job.setProcessing(true);
      await expect(job.process()).resolves.toBeUndefined();
    });

    it('should correctly redenominate all points', async () => {
      //
    });
  });
});

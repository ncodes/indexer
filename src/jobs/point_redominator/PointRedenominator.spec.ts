import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Point from '../../models/point';
import PointRedenominator from './PointRedenominator';

describe('PointRedenominator', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: PointRedenominator;
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
      providers: [ConfigService, PointRedenominator],
    }).compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<PointRedenominator>(PointRedenominator);
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
      let p1 = await Point.create({ point: '1000000000000', redenominated: false });
      let p2 = await Point.create({ point: '2000000000000', redenominated: false });

      await expect(job.process()).resolves.toBeUndefined();
      p1 = await Point.getById(p1.id);
      expect(p1.redenominated).toBe(true);
      expect(p1.point).toBe('100000000');

      await expect(job.process()).resolves.toBeUndefined();
      p2 = await Point.getById(p2.id);
      expect(p2.redenominated).toBe(true);
      expect(p2.point).toBe('200000000');

      await expect(job.process()).resolves.toBeUndefined();
      p1 = await Point.getById(p1.id);
      expect(p1.point).toBe('100000000');
    });
  });
});

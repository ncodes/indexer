import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import ExchangeRateFetcher from './ExchangeRateFetcher';

const mockUpdateCache = jest.fn();
const ExchangeRateServiceMock = jest.fn().mockImplementation(() => {
  return { updateCache: mockUpdateCache };
});

describe('ExchangeRateCacher', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: ExchangeRateFetcher;

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();
    ExchangeRateServiceMock.mockClear();
    mockUpdateCache.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, ExchangeRateFetcher, ExchangeRateService],
    })
      .overrideProvider(ExchangeRateService)
      .useValue(new ExchangeRateServiceMock())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<ExchangeRateFetcher>(ExchangeRateFetcher);
    await app.init();
  });

  describe('.process', () => {
    it('should return undefined if job is already processing', async () => {
      job.setProcessing(true);
      await expect(job.process()).resolves.toBeUndefined();
    });

    it('should call price service to update price of assets', async () => {
      await expect(job.process()).resolves.toBeUndefined();
      expect(mockUpdateCache).toHaveBeenCalled();
    });
  });
});

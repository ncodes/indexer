import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { AirdropController } from './airdrop.controller';

describe('AssetsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();

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
    jest.resetModules();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AirdropController],
      providers: [],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.', () => {
    describe('.getTokenList', () => {
      // it('should return 400 when network is unknown', async () => {
      // await request(app.getHttpServer())
      // .get(`/v1/assets/unknown`)
      // .expect(400)
      // .expect({ error: { type: 'invalid_request_error', message: 'network is unknown' } });
      // });
    });
  });
});

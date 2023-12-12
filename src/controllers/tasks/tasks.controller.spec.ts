import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import MineTask, { MineTaskType } from '../../models/mine_task';
import { TasksController } from './tasks.controller';

describe('TaskController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';

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

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [TasksController],
      providers: [ConfigService],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.list', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tasks`)
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tasks`)
        .query({ net })
        .expect(400)
        .expect({
          error: {
            message: 'type is required',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and empty when no task of the given type exists', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tasks`)
        .query({ net, type: MineTaskType.Draft })
        .expect(200)
        .expect({ data: [] });
    });

    it('should return 200 and task matching the given type exists', async () => {
      const task = await MineTask.create({
        network: net,
        type: MineTaskType.Draft,
        mineAt: moment().toISOString(),
      });
      await MineTask.create({
        network: net,
        type: MineTaskType.Draft,
        mineAt: moment().add(1, 'minute').toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/tasks`)
        .query({ net, type: MineTaskType.Draft })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(task.id);
        });
    });
  });
});

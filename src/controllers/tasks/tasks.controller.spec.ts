import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import * as request from 'supertest';
import { TasksController } from './tasks.controller';
import { SupportedNetworks } from '../../network/common';
import MineTask, { MineTaskType } from '../../models/mine_task';
import * as moment from 'moment';
import Meta from '../../models/meta';
import AssetRegistry from '../../models/asset_registry';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('TaskController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};
  const net = SupportedNetworks.Ethereum;
  const token = '0xToken';
  const token2 = '0xToken2';

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

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [TasksController],
      providers: [ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .compile();
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

    it('should return 200 and task matching the given type' + ' exists', async () => {
      const task = await MineTask.create({
        network: net,
        type: MineTaskType.Draft,
        mineAt: moment().toISOString(),
      });
      const task2 = await MineTask.create({
        network: net,
        type: MineTaskType.Draft,
        mineAt: moment().add(1, 'minute').toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/tasks`)
        .query({ net, type: MineTaskType.Draft })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(task.id);
          expect(res.body.data[1].id).toEqual(task2.id);
        });
    });

    describe('when there are no tasks for FeeTransfer type', () => {
      it('should return 200 and shareable assets', async () => {
        await AssetRegistry.create({ network: net, address: token, sharable: true });
        await AssetRegistry.create({ network: net, address: token2, sharable: true });
        await request(app.getHttpServer())
          .get(`/v1/tasks`)
          .query({ net, type: MineTaskType.FeeTransfer })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].network).toEqual(net);
            expect(res.body.data[0].transferredToken).toEqual(token);
            expect(res.body.data[1].network).toEqual(net);
            expect(res.body.data[1].transferredToken).toEqual(token2);
          });
      });
    });
  });
});

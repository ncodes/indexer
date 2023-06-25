import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import { makeSession } from '../auth/utils';
import { NotificationsController } from './notifications.controller';
import Notification, { NotificationType } from '../../models/notification';
import { randStr } from '../../common/common';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('NotificationsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};

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
      controllers: [NotificationsController],
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

  let u: User;
  let token: string;
  const net = 'ethereum';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.list', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/notifications`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/notifications`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return correct result', async () => {
      const notif = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
      await request(app.getHttpServer())
        .get(`/v1/notifications`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(notif.id);
        });
    });

    describe('read=true', () => {
      it('should return read result', async () => {
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        const notif = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          read: true,
        });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, read: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(notif.id);
          });
      });
    });

    describe('limit=1', () => {
      it('should return correct results', async () => {
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        const notif = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          read: true,
        });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(notif.id);
          });
      });
    });

    describe('offset > 0', () => {
      it('should return correct results', async () => {
        const notif = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id, read: true });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(notif.id);
          });
      });
    });

    describe('count=true', () => {
      it('should return correct results', async () => {
        const notif = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id, read: true });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, count: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.count).toEqual('2');
          });
      });
    });
  });

  describe('.markAsRead', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/0x123/mark-read`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when notification was not found', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/0x123/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            message: 'notification not found',
          },
        });
    });

    it('should return 200 when update was successful', async () => {
      let notif = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
      await request(app.getHttpServer())
        .put(`/v1/notifications/${notif.id}/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect({
          data: { ok: true },
        });
      notif = await Notification.find({ id: notif.id });
      expect(notif.read).toBeTruthy();
    });
  });
});

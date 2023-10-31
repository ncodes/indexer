import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/DBService';
import Convo from '../../models/convo';
import Notification, { NotificationType } from '../../models/notification';
import Offer from '../../models/offer';
import OnlineStatus from '../../models/online_status';
import Swap from '../../models/swap';
import User from '../../models/user';
import { RedisService } from '../../services/redis.service';
import { makeSession } from '../auth/utils';
import { NotificationID, NotifierService } from './../../jobs/mailer/NotifierService';
import { NotificationsController } from './notifications.controller';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockNotify = jest.fn();
const NotifierServiceMock = jest.fn().mockImplementation(() => {
  return {
    notify: mockNotify,
  };
});

const mockExist = jest.fn();
const mockSetWithExpire = jest.fn();
const RedisServiceMock = jest.fn().mockImplementation(() => {
  return {
    exist: mockExist,
    setWithExpire: mockSetWithExpire,
  };
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

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
      'app.rootAdminUser': 'admin',
      'app.rootAdminPass': 'admin',
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [NotificationsController],
      providers: [ConfigService, NotifierService, RedisService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NotifierService)
      .useValue(new NotifierServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
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
    u = await User.create({ role: Roles.User, address: '0xAddress' });
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
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
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

  describe('.newChatNotification', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when token was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'token is required',
            param: 'token',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when topic was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
        })
        .expect(400)
        .expect({
          error: {
            message: 'topic is required',
            param: 'topic',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when timestamp was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
        })
        .expect(400)
        .expect({
          error: {
            message: 'timestamp is required',
            param: 'timestamp',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when message was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
        })
        .expect(400)
        .expect({
          error: {
            message: 'message is required',
            param: 'message',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when no user with matching token', async () => {
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(404)
        .expect({
          error: {
            message: 'user not found',
          },
        });
    });

    it('should return 404 when no convo with a matching topic', async () => {
      await User.create({ deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(404)
        .expect({
          error: {
            message: 'convo not found',
          },
        });
    });

    it('should return 200 and false when convo has been muted', async () => {
      await User.create({ deviceTokenEmail: 'token-01' });
      await Convo.create({ network: net, topic: 'topic', muted: true });

      mockExist.mockReturnValueOnce(true);

      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toEqual({ ok: false });
        });
    });

    it('should return 200 and false when message has been seen before', async () => {
      await User.create({ deviceTokenEmail: 'token-01' });
      await Convo.create({ network: net, topic: 'topic' });

      mockExist.mockReturnValueOnce(true);

      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toEqual({ ok: false });
        });
    });

    it('should return 200 and false when convo has been locked', async () => {
      await User.create({ deviceTokenEmail: 'token-01' });
      await Convo.create({ network: net, topic: 'topic' });

      mockExist.mockReturnValueOnce(false);
      mockExist.mockReturnValueOnce(true);

      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toEqual({ ok: false });
        });
    });

    it('should return 200 and false when notification was not sent', async () => {
      await User.create({ deviceTokenEmail: 'token-01' });
      await Convo.create({ network: net, topic: 'topic' });

      mockExist.mockReturnValueOnce(false);
      mockExist.mockReturnValueOnce(false);

      await request(app.getHttpServer())
        .post(`/v1/notifications/new-message`)
        .auth('admin', 'admin')
        .send({
          token: 'token-01',
          topic: 'topic',
          timestamp: 123,
          message: 'hello there',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toEqual({ ok: false });
        });
    });

    describe('conversation linked to a swap', () => {
      it('should return 200 and send notification to taker when provider is online and taker is not', async () => {
        await User.create({ deviceTokenEmail: 'token-01' });
        const taker = await User.create({ address: '0xTaker' });
        await Swap.create({ network: net, orderId: 1, taker: '0xTaker', provider: '0xProvider' });
        const convo = await Convo.create({ network: net, topic: 'topic', orderId: 1 });
        await OnlineStatus.create({ network: net, address: '0xProvider', orderId: 1 });

        mockExist.mockReturnValueOnce(false);
        mockExist.mockReturnValueOnce(false);

        await request(app.getHttpServer())
          .post(`/v1/notifications/new-message`)
          .auth('admin', 'admin')
          .send({
            token: 'token-01',
            topic: 'topic',
            timestamp: 123,
            message: 'hello there',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data).toEqual({ ok: true });
            expect(mockNotify.mock.calls).toHaveLength(1);
            const call = mockNotify.mock.calls[0];
            expect(call[0]).toEqual(NotificationID.ChatNewMessage);
            expect(call[1]).toBeUndefined();
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(taker.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });

      it('should return 200 and send notification to provider when taker is online and provider is not', async () => {
        await User.create({ deviceTokenEmail: 'token-01' });
        const provider = await User.create({ address: '0xProvider' });
        await Swap.create({ network: net, orderId: 1, taker: '0xTaker', provider: '0xProvider' });
        const convo = await Convo.create({ network: net, topic: 'topic', orderId: 1 });
        await OnlineStatus.create({ network: net, address: '0xTaker', orderId: 1 });

        mockExist.mockReturnValueOnce(false);
        mockExist.mockReturnValueOnce(false);

        await request(app.getHttpServer())
          .post(`/v1/notifications/new-message`)
          .auth('admin', 'admin')
          .send({
            token: 'token-01',
            topic: 'topic',
            timestamp: 123,
            message: 'hello there',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data).toEqual({ ok: true });
            expect(mockNotify.mock.calls).toHaveLength(1);
            const call = mockNotify.mock.calls[0];
            expect(call[0]).toEqual(NotificationID.ChatNewMessage);
            expect(call[1]).toBeUndefined();
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(provider.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });
    });

    describe('conversation linked to a offer', () => {
      it('should return 200 and send notification to taker when provider is online and taker is not', async () => {
        await User.create({ deviceTokenEmail: 'token-01' });
        const taker = await User.create({ address: '0xTaker' });
        await Offer.create({ network: net, offerId: 1, creator: '0xTaker', provider: '0xProvider' });
        const convo = await Convo.create({ network: net, topic: 'topic', offerId: 1 });
        await OnlineStatus.create({ network: net, address: '0xProvider', offerId: 1 });

        mockExist.mockReturnValueOnce(false);
        mockExist.mockReturnValueOnce(false);

        await request(app.getHttpServer())
          .post(`/v1/notifications/new-message`)
          .auth('admin', 'admin')
          .send({
            token: 'token-01',
            topic: 'topic',
            timestamp: 123,
            message: 'hello there',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data).toEqual({ ok: true });
            expect(mockNotify.mock.calls).toHaveLength(1);
            const call = mockNotify.mock.calls[0];
            expect(call[0]).toEqual(NotificationID.ChatNewMessage);
            expect(call[1]).toBeUndefined();
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(taker.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });

      it('should return 200 and send notification to provider when taker is online and provider is not', async () => {
        await User.create({ deviceTokenEmail: 'token-01' });
        const provider = await User.create({ address: '0xProvider' });
        await Offer.create({ network: net, offerId: 1, creator: '0xTaker', provider: '0xProvider' });
        const convo = await Convo.create({ network: net, topic: 'topic', offerId: 1 });
        await OnlineStatus.create({ network: net, address: '0xTaker', offerId: 1 });

        mockExist.mockReturnValueOnce(false);
        mockExist.mockReturnValueOnce(false);

        await request(app.getHttpServer())
          .post(`/v1/notifications/new-message`)
          .auth('admin', 'admin')
          .send({
            token: 'token-01',
            topic: 'topic',
            timestamp: 123,
            message: 'hello there',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data).toEqual({ ok: true });
            expect(mockNotify.mock.calls).toHaveLength(1);
            const call = mockNotify.mock.calls[0];
            expect(call[0]).toEqual(NotificationID.ChatNewMessage);
            expect(call[1]).toBeUndefined();
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(provider.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });
    });
  });
});

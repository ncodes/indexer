import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import { NotificationID } from '../../jobs/mailer/common';
import Convo from '../../models/convo';
import Notification, { NotificationType } from '../../models/notification';
import NotificationSetting from '../../models/notification_setting';
import Offer from '../../models/offer';
import OnlineStatus from '../../models/online_status';
import Swap from '../../models/swap';
import User from '../../models/user';
import { RedisService } from '../../services/redis/redis.service';
import { makeSession } from '../auth/utils';
import { NotifierService } from './../../jobs/mailer/NotifierService';
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
    mockExist.mockReset();

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

    describe('type was set', () => {
      it('should return correct result', async () => {
        await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        const notif = await Notification.create({
          type: NotificationType.CommitPhaseEnded,
          network: net,
          userId: u.id,
        });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, type: NotificationType.CommitPhaseEnded })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(notif.id);
          });
      });
    });

    describe('orderId was set', () => {
      it('should return correct result', async () => {
        await Notification.create({ type: NotificationType.InstantSwap, orderId: 2, network: net, userId: u.id });
        const notif = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          orderId: 1,
        });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, orderId: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(notif.id);
          });
      });
    });

    describe('offerId was set', () => {
      it('should return correct result', async () => {
        await Notification.create({ type: NotificationType.InstantSwap, offerId: 2, network: net, userId: u.id });
        const notif = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          offerId: 1,
        });
        await request(app.getHttpServer())
          .get(`/v1/notifications`)
          .query({ net, offerId: 1 })
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
        .put(`/v1/notifications/mark-read`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    describe('when id is set', () => {
      it('should return 200 and update correct records', async () => {
        let notif = await Notification.create({ type: NotificationType.ChatNewMessage, network: net, userId: u.id });
        let notif2 = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        await request(app.getHttpServer())
          .put(`/v1/notifications/mark-read`)
          .set('Authorization', 'bearer ' + token)
          .send({ net, id: notif2.id })
          .expect(200)
          .expect({
            data: { ok: true },
          });
        notif = await Notification.find({ id: notif.id });
        expect(notif.read).toBeFalsy();
        notif2 = await Notification.find({ id: notif2.id });
        expect(notif2.read).toBeTruthy();
      });
    });

    describe('when type is set', () => {
      it('should return 200 and update correct records', async () => {
        let notif = await Notification.create({ type: NotificationType.ChatNewMessage, network: net, userId: u.id });
        let notif2 = await Notification.create({ type: NotificationType.InstantSwap, network: net, userId: u.id });
        await request(app.getHttpServer())
          .put(`/v1/notifications/mark-read`)
          .set('Authorization', 'bearer ' + token)
          .send({ net, type: NotificationType.ChatNewMessage })
          .expect(200)
          .expect({
            data: { ok: true },
          });
        notif = await Notification.find({ id: notif.id });
        expect(notif.read).toBeTruthy();
        notif2 = await Notification.find({ id: notif2.id });
        expect(notif2.read).toBeFalsy();
      });
    });

    describe('when orderId is set', () => {
      it('should return 200 and update correct records', async () => {
        let notif = await Notification.create({
          type: NotificationType.ChatNewMessage,
          network: net,
          userId: u.id,
          orderId: 1,
        });
        let notif2 = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          orderId: 2,
        });
        await request(app.getHttpServer())
          .put(`/v1/notifications/mark-read`)
          .set('Authorization', 'bearer ' + token)
          .send({ net, orderId: 2 })
          .expect(200)
          .expect({
            data: { ok: true },
          });
        notif2 = await Notification.find({ id: notif2.id });
        expect(notif2.read).toBeTruthy();
        notif = await Notification.find({ id: notif.id });
        expect(notif.read).toBeFalsy();
      });
    });

    describe('when offerId is set', () => {
      it('should return 200 and update correct records', async () => {
        let notif = await Notification.create({
          type: NotificationType.ChatNewMessage,
          network: net,
          userId: u.id,
          offerId: 1,
        });
        let notif2 = await Notification.create({
          type: NotificationType.InstantSwap,
          network: net,
          userId: u.id,
          offerId: 2,
        });
        await request(app.getHttpServer())
          .put(`/v1/notifications/mark-read`)
          .set('Authorization', 'bearer ' + token)
          .send({ net, offerId: 2 })
          .expect(200)
          .expect({
            data: { ok: true },
          });
        notif2 = await Notification.find({ id: notif2.id });
        expect(notif2.read).toBeTruthy();
        notif = await Notification.find({ id: notif.id });
        expect(notif.read).toBeFalsy();
      });
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

    it('should return 200 and false when recipient has been locked', async () => {
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
      it('should return 200 and send notification to convo peer when user is online and convo peer is not online', async () => {
        const swap = await Swap.create({ network: net, orderId: 1 });
        await User.create({ deviceTokenEmail: 'token-01', address: '0xAddress2' });
        const peer = await User.create({ address: '0xPeer' });
        const convo = await Convo.create({
          network: net,
          topic: 'topic',
          orderId: swap.orderId,
          address: '0xAddress2',
          peerAddress: '0xPeer',
        });
        await OnlineStatus.create({ network: net, address: '0xAddress2', orderId: 1 });

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
            expect(call[1]).toEqual(net);
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(peer.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });

      it('should return 200 and send notification to user when peer is online and user is not', async () => {
        const swap = await Swap.create({ network: net, orderId: 1 });
        const user = await User.create({ deviceTokenEmail: 'token-01', address: '0xAddress2' });
        await User.create({ address: '0xPeer' });
        const convo = await Convo.create({
          network: net,
          topic: 'topic',
          orderId: swap.orderId,
          address: '0xAddress2',
          peerAddress: '0xPeer',
        });
        await OnlineStatus.create({ network: net, address: '0xPeer', orderId: 1 });

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
            expect(call[1]).toEqual(net);
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(user.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });
    });

    describe('conversation linked to a offer', () => {
      it('should return 200 and send notification to peer when user is online and peer is not', async () => {
        const offer = await Offer.create({ network: net, offerId: 1 });
        await User.create({ deviceTokenEmail: 'token-01', address: '0xAddress2' });
        const peer = await User.create({ address: '0xPeer' });
        const convo = await Convo.create({
          network: net,
          topic: 'topic',
          offerId: offer.offerId,
          address: '0xAddress2',
          peerAddress: '0xPeer',
        });
        await OnlineStatus.create({ network: net, address: '0xAddress2', offerId: 1 });

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
            expect(call[1]).toEqual(net);
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(peer.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });

      it('should return 200 and send notification to user when peer is online and user is not', async () => {
        const offer = await Offer.create({ network: net, offerId: 1 });
        const user = await User.create({ deviceTokenEmail: 'token-01', address: '0xAddress2' });
        await User.create({ address: '0xPeer' });
        const convo = await Convo.create({
          network: net,
          topic: 'topic',
          offerId: offer.offerId,
          address: '0xAddress2',
          peerAddress: '0xPeer',
        });
        await OnlineStatus.create({ network: net, address: '0xPeer', offerId: 1 });

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
            expect(call[1]).toEqual(net);
            expect(call[2]).toBeUndefined();
            expect(call[3].user.id).toEqual(user.id);
            expect(call[3].convo.id).toEqual(convo.id);
          });
      });
    });
  });

  describe('.updateSettings', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/settings`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return when token is invalid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/settings`)
        .set('Authorization', 'bearer invalid')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return when token is invalid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/notifications/settings`)
        .set('Authorization', 'bearer ' + token)
        .send({
          disabled: true,
          disabledSwap: true,
          disabledOffer: true,
          disabledLiq: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.userId).toEqual(u.id);
          expect(res.body.data.disabled).toBeTruthy();
          expect(res.body.data.disabledSwap).toBeTruthy();
          expect(res.body.data.disabledOffer).toBeTruthy();
          expect(res.body.data.disabledLiq).toBeTruthy();
        });

      let notifSet = await NotificationSetting.getByUserId(u.id);
      expect(notifSet.disabled).toBeTruthy();
      expect(notifSet.disabledSwap).toBeTruthy();
      expect(notifSet.disabledOffer).toBeTruthy();
      expect(notifSet.disabledLiq).toBeTruthy();

      await request(app.getHttpServer())
        .put(`/v1/notifications/settings`)
        .set('Authorization', 'bearer ' + token)
        .send({
          disabled: false,
          disabledSwap: false,
          disabledOffer: false,
          disabledLiq: false,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.userId).toEqual(u.id);
          expect(res.body.data.disabled).toBeFalsy();
          expect(res.body.data.disabledSwap).toBeFalsy();
          expect(res.body.data.disabledOffer).toBeFalsy();
          expect(res.body.data.disabledLiq).toBeFalsy();
        });

      notifSet = await NotificationSetting.getByUserId(u.id);
      expect(notifSet.disabled).toBeFalsy();
      expect(notifSet.disabledSwap).toBeFalsy();
      expect(notifSet.disabledOffer).toBeFalsy();
      expect(notifSet.disabledLiq).toBeFalsy();
    });
  });
});

import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Convo from '../../models/convo';
import User from '../../models/user';
import { makeSession } from '../auth/utils';
import { ConvosController } from './convos.controller';
import ConvosService from './convos.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('ConvosController', () => {
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
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [ConvosController],
      providers: [ConfigService, ConvosService],
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
    u = await User.create({ role: Roles.User, address: '0xAddress' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.subscribeToConvos', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
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
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
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

    it('should return 400 when no topic was provided', async () => {
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          topics: [],
        })
        .expect(400)
        .expect({
          error: {
            message: 'at least one topic is required',
            param: 'topics',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when no peer address was provided', async () => {
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          topics: ['topic'],
        })
        .expect(400)
        .expect({
          error: {
            message: 'at least one peer address is required',
            param: 'peerAddresses',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when a peer address is not a valid ethereum address', async () => {
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          topics: ['topic'],
          peerAddresses: ['abc'],
          orderId: 1,
        })
        .expect(400)
        .expect({
          error: {
            param: 'peerAddresses',
            type: 'invalid_request_error',
            message: 'invalid peer address found',
          },
        });
    });

    it('should return 400 when either orderId or offerId was not provided', async () => {
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          topics: ['topic'],
          peerAddresses: ['abc'],
        })
        .expect(400)
        .expect({
          error: {
            message: 'orderId or offerId is required',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 201 and subscribe to topics and create a convo entry', async () => {
      const mockSubscribe = jest.spyOn(app.get(ConvosService), 'subscribe').mockReturnValue(undefined);
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/subscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          orderId: 1,
          topics: ['topic', 'topic2'],
          peerAddresses: ['0xB24780438dD4DB52848A3A398B1A8A08223aBd83', '0xB24780438dD4DB52848A3A398B1A8A08223aBd84'],
        })
        .expect(201)
        .expect(async (res) => {
          expect(res.body.data).toEqual({ ok: true });
          expect(mockSubscribe).toBeCalledWith(u.id, ['topic', 'topic2']);
          const convo = await Convo.get(net, u.address, 'topic');
          expect(convo).toBeDefined();
          expect(convo.peerAddress).toEqual('0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
          const convo2 = await Convo.get(net, u.address, 'topic2');
          expect(convo2).toBeDefined();
          expect(convo2.peerAddress).toEqual('0xB24780438dD4DB52848A3A398B1A8A08223aBd84');
        });
    });
  });

  describe('.unsubscribeToConvos', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/convos/unsubscribe`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 201 and unsubscribe to topics', async () => {
      const mockUnsubscribe = jest.spyOn(app.get(ConvosService), 'unsubscribe').mockReturnValue(undefined);
      await User.updateById(u.id, { deviceTokenEmail: 'token-01' });
      await request(app.getHttpServer())
        .post(`/v1/convos/unsubscribe`)
        .set('Authorization', 'bearer ' + token)
        .send({
          topics: ['topic', 'topic2'],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual({ ok: true });
          expect(mockUnsubscribe).toBeCalledWith(u.id, ['topic', 'topic2']);
        });
    });
  });

  describe('.getConvoByTopic', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/convos/net/topic`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when convo is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/convos/net/topic`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(404)
        .expect({
          error: {
            message: 'convo not found',
          },
        });
    });

    it('should return 200 and convo', async () => {
      const topic = '/xmtp/0/m-b06fdc5f8beb8779b31c71c072c7221189f9d6b7757e539481cad8e94927b6fc/proto';
      const convo = await Convo.create({ network: net, topic, address: u.address });
      await request(app.getHttpServer())
        .get(`/v1/convos/${net}/${topic.replaceAll('/', '_')}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(convo.id);
        });
    });
  });

  describe('.toggleConvoMute', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/convos/net/topic/toggle-mute`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when convo is unknown', async () => {
      await request(app.getHttpServer())
        .put(`/v1/convos/net/topic/toggle-mute`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(404)
        .expect({
          error: {
            message: 'convo not found',
          },
        });
    });

    it('should return 200 and mute convo if unmuted', async () => {
      const topic = '/xmtp/0/m-b06fdc5f8beb8779b31c71c072c7221189f9d6b7757e539481cad8e94927b6fc/proto';
      const convo = await Convo.create({ network: net, topic, address: u.address });
      await request(app.getHttpServer())
        .put(`/v1/convos/${net}/${topic.replaceAll('/', '_')}/toggle-mute`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect(async (res) => {
          expect(res.body.data.muted).toBeTruthy();
          const upd = await Convo.getById(convo.id);
          expect(upd.muted).toBeTruthy();
        });
    });

    it('should return 200 and unmute convo if muted', async () => {
      const convo = await Convo.create({ network: net, muted: true, topic: 'topic', address: u.address });
      await request(app.getHttpServer())
        .put(`/v1/convos/${net}/topic/toggle-mute`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect(async (res) => {
          expect(res.body.data.muted).toBeFalsy();
          const upd = await Convo.getById(convo.id);
          expect(upd.muted).toBeFalsy();
        });
    });
  });
});

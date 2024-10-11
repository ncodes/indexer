import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { delay, randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Appeal from '../../models/appeal';
import AppealMessage from '../../models/appeal_message';
import PayRouterRequest from '../../models/pay_router_request';
import PayRouterRoute from '../../models/pay_router_route';
import Swap from '../../models/swap';
import User from '../../models/user';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis/redis.service';
import { makeSession } from '../auth/utils';
import { FilesService } from '../files/files.service';
import { MarketService } from '../markets/market.service';
import { AppealsController } from './appeals.controller';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const mockCidExists = jest.fn();
const mockGetSignedUrl = jest.fn();
const FilesServiceMock = jest.fn().mockImplementation(() => {
  return { cidExists: mockCidExists, getSignedUrl: mockGetSignedUrl };
});

describe('AppealsController', () => {
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
    mockGetMarketCore.mockReset();
    mockCidExists.mockReset();
    mockGetSignedUrl.mockReset();

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AppealsController],
      providers: [
        ConfigService,
        NetworkService,
        FilesService,
        MarketService,
        MetadataService,
        RedisService,
        ExchangeRateService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .overrideProvider(ExchangeRateService)
      .useValue(new (jest.fn())())
      .overrideProvider(FilesService)
      .useValue(new FilesServiceMock())
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
    u = await User.create({ role: Roles.User, address: '0xUser' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.create', () => {
    it('should return 401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + 'invalid_token')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 400 when order ID was not provided or not a numbers', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'must be a number',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when issue was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0 })
        .expect(400)
        .expect({
          error: {
            message: 'issue is required',
            param: 'issue',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when issue is too long', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0, issue: 'a'.repeat(251) })
        .expect(400)
        .expect({
          error: {
            message: 'issue is too long',
            param: 'issue',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when description was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0, issue: 'issue' })
        .expect(400)
        .expect({
          error: {
            message: 'description is required',
            param: 'description',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when description is too long', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0, issue: 'issue', description: 'a'.repeat(501) })
        .expect(400)
        .expect({
          error: {
            message: 'description is too long',
            param: 'description',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is not supported', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0, issue: 'issue', description: 'description' })
        .expect(400)
        .expect({
          error: {
            type: 'net',
            message: 'network is unknown',
          },
        });
    });

    it('should return 404 when order was not found', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/localhost`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: 0, issue: 'issue', description: 'description' })
        .expect(404)
        .expect({
          error: {
            param: 'orderId',
            message: 'order not found',
          },
        });
    });

    it('should return 400 when order is not paid', async () => {
      const order = await Swap.create({ network: net, orderId: 0 });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description' })
        .expect(400)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'order must be marked as paid',
          },
        });
    });

    it('should return 400 when a file does not existing', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true });
      mockCidExists.mockImplementation(() => false);
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description', files: ['file_123'] })
        .expect(400)
        .expect({
          error: {
            message: 'file not found: file_123',
            param: 'files',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 201 and save the file urls file is ok', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true });
      mockCidExists.mockImplementation(() => true);
      mockGetSignedUrl.mockImplementation(() => 'https://file.com/file_123');
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description', files: ['file_123'] })
        .expect(201)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal');
          expect(body.orderId).toBe(order.id);
          expect(body.issue).toBe('issue');
          expect(body.description).toBe('description');
          expect(body.files).toEqual(['file_123']);
          expect(body.fileUrls).toEqual(['https://file.com/file_123']);
        });
    });

    it('should return 201 when appeal was created', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description' })
        .expect(201)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal');
          expect(body.orderId).toBe(order.id);
          expect(body.issue).toBe('issue');
        });
    });

    it('should return 400 when appeal already exists', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true });
      await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description' })
        .expect(400)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'appeal already exists',
          },
        });
    });

    it('should return 400 when order is not in dispute period', async () => {
      const order = await Swap.create({
        network: net,
        paid: true,
        orderId: 0,
        disputeFrom: moment().add(1, 'day').toISOString(),
      });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description' })
        .expect(400)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'order not ready for appeal',
          },
        });
    });

    it('should return 400 when order has been released', async () => {
      const order = await Swap.create({
        network: net,
        orderId: 0,
        paid: true,
        released: true,
        disputeFrom: moment().toISOString(),
      });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({ orderId: order.orderId, issue: 'issue', description: 'description' })
        .expect(400)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'order already released',
          },
        });
    });
  });

  describe('.get', () => {
    it('should return 401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + 'invalid_token')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 404 when appeal does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'id',
            message: 'appeal not found',
          },
        });
    });

    it('should return 404 when order does not exist', async () => {
      const appeal = await Appeal.create({ network: net, orderId: 'order_123', issue: 'issue' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'orderId',
            message: 'order not found',
          },
        });
    });

    it('should return 403 when user is not a counterparty or router in the order', async () => {
      const order = await Swap.create({ network: net, provider: '0xProvider', taker: '0xTaker' });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(403)
        .expect({
          error: {
            message: 'user is not authorized to access this appeal',
          },
        });
    });

    it('should return 200 when user is a counterparty or router in the order', async () => {
      const order = await Swap.create({ network: net, provider: '0xProvider', taker: '0xTaker', orderId: 0 });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

      await User.updateById(u.id, { address: '0xProvider' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal');
          expect(body.orderId).toBe(order.id);
        });

      await User.updateById(u.id, { address: '0xTaker' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal');
          expect(body.orderId).toBe(order.id);
        });

      await PayRouterRequest.create({ network: net, orderId: order.orderId, routeIds: [0] });
      await PayRouterRoute.create({ network: net, routeId: 0, owner: '0xUser' });
      await User.updateById(u.id, { address: '0xUser' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal');
          expect(body.orderId).toBe(order.id);
        });
    });
  });

  describe('.createMessage', () => {
    it('should return 401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + 'invalid_token')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 400 when text and files are not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'text is required',
            param: 'text',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when text is too long', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ text: 'a'.repeat(501) })
        .expect(400)
        .expect({
          error: {
            message: 'text is too long',
            param: 'text',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when too many files are provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ text: 'message', files: ['file1', 'file2', 'file3', 'file4', 'file5'] })
        .expect(400)
        .expect({
          error: {
            message: 'maximum of 4 files per message',
            param: 'files',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when appeal does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ text: 'message' })
        .expect(404)
        .expect({
          error: {
            param: 'id',
            message: 'appeal not found',
          },
        });
    });

    it('should return 403 when user is not a counterparty or router in the order', async () => {
      const order = await Swap.create({
        network: net,
        orderId: 0,
        paid: true,
        provider: '0xProvider',
        taker: '0xTaker',
      });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${appeal.id}/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ text: 'message' })
        .expect(403);
    });

    it('should return 201 when message was created', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });
      await request(app.getHttpServer())
        .post(`/v1/appeals/${appeal.id}/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ text: 'message' })
        .expect(201)
        .expect((res) => {
          const body = res.body.data;
          expect(body.object).toBe('appeal_msg');
          expect(body.appealId).toBe(appeal.id);
          expect(body.orderId).toBe(appeal.orderId);
          expect(body.creatorId).toBe(u.id);
          expect(body.text).toBe('message');
        });
    });

    describe('with files', () => {
      it('should return 400 when file does not exist', async () => {
        const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
        const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

        await request(app.getHttpServer())
          .post(`/v1/appeals/${appeal.id}/messages`)
          .set('Authorization', 'bearer ' + token)
          .send({ text: 'message', files: ['file1'] })
          .expect(400)
          .expect({
            error: {
              param: 'files',
              type: 'invalid_request_error',
              message: 'file not found: file1',
            },
          });
      });

      it('should return store files and fetch and save signed urls', async () => {
        const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
        const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

        mockCidExists.mockResolvedValue(true);
        mockGetSignedUrl.mockResolvedValue('https://pinata.cloud/ipfs/file1');

        await request(app.getHttpServer())
          .post(`/v1/appeals/${appeal.id}/messages`)
          .set('Authorization', 'bearer ' + token)
          .send({ text: 'message', files: ['file1'] })
          .expect(201)
          .expect((res) => {
            const body = res.body.data;
            expect(body.object).toBe('appeal_msg');
            expect(body.appealId).toBe(appeal.id);
            expect(body.orderId).toBe(appeal.orderId);
            expect(body.creatorId).toBe(u.id);
            expect(body.text).toBe('message');
            expect(body.files).toStrictEqual(['file1']);
            expect(body.fileUrls).toStrictEqual(['https://pinata.cloud/ipfs/file1']);
          });
      });
    });
  });

  describe('.getMessages', () => {
    it('should return 401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown/messages`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + 'invalid_token')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 404 when appeal does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/v1/appeals/unknown/messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'id',
            message: 'appeal not found',
          },
        });
    });

    it('should return 403 when user is not a counterparty or router in the order', async () => {
      const order = await Swap.create({
        network: net,
        orderId: 0,
        paid: true,
        provider: '0xProvider',
        taker: '0xTaker',
      });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });
      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}/messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(403)
        .expect({
          error: {
            message: 'user is not authorized to perform this action',
          },
        });
    });

    it('should return 200 and messages associated with the appeal', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

      await AppealMessage.create({
        appealId: appeal.id,
        orderId: appeal.orderId,
        creatorId: u.id,
        text: 'message1',
      });
      await delay(1);
      await AppealMessage.create({
        appealId: appeal.id,
        orderId: appeal.orderId,
        creatorId: 'user_xyz',
        text: 'message2',
      });
      await delay(1);
      await AppealMessage.create({ appealId: appeal.id, orderId: appeal.orderId, creatorId: u.id, text: 'message3' });
      await delay(1);

      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}/messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.length).toBe(3);
          expect(body[0].text).toBe('message3');
          expect(body[1].text).toBe('message2');
          expect(body[2].text).toBe('message1');
        });
    });

    it('should return 200 and messages associated with the appeal with creatorId filter', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

      await AppealMessage.create({ appealId: appeal.id, orderId: appeal.orderId, creatorId: u.id, text: 'message1' });
      await delay(1);
      await AppealMessage.create({
        appealId: appeal.id,
        orderId: appeal.orderId,
        creatorId: 'user_xyz',
        text: 'message2',
      });
      await delay(1);
      await AppealMessage.create({ appealId: appeal.id, orderId: appeal.orderId, creatorId: u.id, text: 'message3' });

      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}/messages`)
        .query({ creatorId: 'user_xyz' })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.length).toBe(1);
          expect(body[0].text).toBe('message2');
        });
    });

    it('should return 200 and messages associated with the appeal with limit', async () => {
      const order = await Swap.create({ network: net, orderId: 0, paid: true, provider: u.address });
      const appeal = await Appeal.create({ network: net, orderId: order.id, issue: 'issue' });

      await AppealMessage.create({ appealId: appeal.id, orderId: appeal.orderId, creatorId: u.id, text: 'message1' });
      await delay(1);
      await AppealMessage.create({ appealId: appeal.id, orderId: appeal.orderId, creatorId: u.id, text: 'message2' });

      await request(app.getHttpServer())
        .get(`/v1/appeals/${appeal.id}/messages`)
        .query({ limit: 1 })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          const body = res.body.data;
          expect(body.length).toBe(1);
          expect(body[0].text).toBe('message2');
        });
    });
  });
});

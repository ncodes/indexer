import { ChainNames } from '@jointlabs/meta';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import PayRouterOrg from '../../models/pay_router_org';
import PaymentMethod from '../../models/payment_method';
import User from '../../models/user';
import { makeSession } from '../auth/utils';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('PaymentsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const net: ChainNames = 'ethereum';
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

    cfgObj = { 'auth.jwtSecret': 'secret_secret', 'app.payRouter.orgCreatorAddress': '0xCreatorAddress' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [PaymentsController],
      providers: [PaymentsService, ConfigService],
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
  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.add', function () {
    it('should return 401 when token is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is not unknown', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net: 'unknown' })
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net })
        .expect(400)
        .expect({
          error: {
            message: 'type is required',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type is unknown', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 4 })
        .expect(400)
        .expect({
          error: {
            message: 'type is unknown',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type is 1 (bank) and payment method name is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1 })
        .expect(400)
        .expect({
          error: {
            message: 'method name is required',
            param: 'name',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when bank account name is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A' })
        .expect(400)
        .expect({
          error: {
            message: 'bank account name is required',
            param: 'bankAccountName',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when bank account number is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A', bankAccountName: 'John Doe' })
        .expect(400)
        .expect({
          error: {
            message: 'bank account number is required',
            param: 'bankAccountNumber',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type=2 (wallet) and method name is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 2 })
        .expect(400)
        .expect({
          error: {
            message: 'method name is required',
            param: 'name',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type=2 and account ID is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 2, name: 'Wallet A' })
        .expect(400)
        .expect({
          error: {
            message: 'account ID is required',
            param: 'accountId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when payment method is unsupported', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A', bankAccountName: 'John Doe', bankAccountNumber: '1234567890' })
        .expect(400)
        .expect({
          error: {
            message: 'payment method is unsupported',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 201 on correct parameters', async () => {
      await PayRouterOrg.create({ orgId: 1, network: net, name: 'Bank A', creator: '0xCreatorAddress' });
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A', bankAccountName: 'John Doe', bankAccountNumber: '1234567890' })
        .expect(201)
        .expect((res) => {
          const body = res.body.data as PaymentMethod;
          expect(body.id).toBeDefined();
          expect(body.network).toBe(net);
          expect(body.type).toBe(1);
          expect(body.name).toBe('Bank A');
          expect(body.bankAccountName).toBe('John Doe');
          expect(body.bankAccountNumber).toBe('1234567890');
        });
    });

    it('should return 400 when user already created the payment method', async () => {
      await PayRouterOrg.create({ orgId: 1, network: net, name: 'Bank A', creator: '0xCreatorAddress' });
      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A', bankAccountName: 'John Doe', bankAccountNumber: '1234567890' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .send({ net, type: 1, name: 'Bank A', bankAccountName: 'John Doe', bankAccountNumber: '1234567890' })
        .expect(400)
        .expect({
          error: {
            message: 'payment method already exists',
            type: 'invalid_request_error',
          },
        });
    });
  });

  describe('.import', () => {
    it('should return 401 when token is not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/import/net1`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 0 when no payment method was imported', async () => {
      await request(app.getHttpServer())
        .post(`/v1/payments/import/net1`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.imported).toBe(0);
        });
    });

    it('should not import payment method if payment method does not have a coresponding pay router org on the import network', async () => {
      await PaymentMethod.create({ name: 'Bank A', network: net, userId: u.id });
      await PaymentMethod.create({ name: 'Bank B', network: 'net2', userId: u.id });
      await request(app.getHttpServer())
        .post(`/v1/payments/import/net1`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.imported).toBe(0);
        });
    });

    it('should import payment method if payment method has a coresponding pay router org on the import network', async () => {
      await PaymentMethod.create({ name: 'Bank A', network: net, userId: u.id });
      await PaymentMethod.create({ name: 'Bank B', network: 'net2', userId: u.id });

      const importNetwork = 'net1';
      await PayRouterOrg.create({ orgId: 1, network: importNetwork, name: 'Bank A', creator: '0xCreatorAddress' });
      await PayRouterOrg.create({ orgId: 2, network: importNetwork, name: 'Bank B', creator: '0xCreatorAddress' });

      await request(app.getHttpServer())
        .post(`/v1/payments/import/${importNetwork}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.imported).toBe(2);
        });
    });

    it('should not import payment method already existing on the import network', async () => {
      await PaymentMethod.create({ name: 'Bank A', network: net, userId: u.id });
      await PaymentMethod.create({ name: 'Bank B', network: 'net2', userId: u.id });

      const importNetwork = 'net1';
      await PayRouterOrg.create({ orgId: 1, network: importNetwork, name: 'Bank A', creator: '0xCreatorAddress' });
      await PayRouterOrg.create({ orgId: 2, network: importNetwork, name: 'Bank B', creator: '0xCreatorAddress' });

      await request(app.getHttpServer())
        .post(`/v1/payments/import/${importNetwork}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.imported).toBe(2);
        });

      await request(app.getHttpServer())
        .post(`/v1/payments/import/${importNetwork}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.imported).toBe(0);
        });
    });
  });

  describe('.list', () => {
    it('should return 401 when token is not provided', async () => {
      await request(app.getHttpServer()).get(`/v1/payments/methods`).expect(401);
    });

    it('should return 200 and existing payment methods', async () => {
      await PaymentMethod.create({ name: 'Bank A', network: net, userId: u.id });
      await PaymentMethod.create({ name: 'Bank B', network: 'net2', userId: u.id });
      await request(app.getHttpServer())
        .get(`/v1/payments/methods`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
        });
    });
  });
});

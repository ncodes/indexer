import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import { makeSession } from '../auth/utils';
import * as cryptoRandomString from 'crypto-random-string';
import { PaymentsController } from './payments.controller';
import * as request from 'supertest';
import { PaymentMethods } from '../../common/payment_methods';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('PaymentsController', () => {
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
      controllers: [PaymentsController],
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
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.updatePaymentMethod', function () {
    it('should return 401 no access token was provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/payments/method`)
        // .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 method was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/payments/method`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: { message: 'method is required', type: 'invalid_request_error' },
        });
    });

    it('should return 400 method provided was invalid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/payments/method`)
        .set('Authorization', 'bearer ' + token)
        .send({ method: 'invalid' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'payment method is invalid',
          },
        });
    });

    it('should return 200 when method provided was valid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/payments/method`)
        .set('Authorization', 'bearer ' + token)
        .send({ method: 'bank_transfer' })
        .expect(200)
        .expect({ data: { ok: true } });
    });
  });

  describe('.getPaymentMethods', function () {
    it('should return correct payment methods', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods`)
        .expect(200)
        .expect({ data: PaymentMethods });
    });
  });
});

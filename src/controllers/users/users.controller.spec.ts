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
import * as cryptoRandomString from 'crypto-random-string';
import { UsersController } from './users.controller';
import { getNameList } from 'country-list';
import Liquidity from '../../models/liquidity';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('UsersController', () => {
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
      controllers: [UsersController],
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
    u = await User.create({ role: Roles.User, address: '0xAddress' });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.get', () => {
    it('should return 404 when user with matching address was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/0xAddress2`)
        .send({})
        .expect(404)
        .expect({
          error: { message: 'user not found' },
        });
    });

    it('should return 401 when provided address is not match auth token user address', async () => {
      await User.updateById(u.id, {
        address: '0xAddress',
        email: '0x@email.com',
      });
      await request(app.getHttpServer())
        .get(`/v1/users/0xAddress2`)
        .send({})
        .set('Authorization', 'bearer ' + token)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 200 and de-sensitized user data when token was not provided', async () => {
      await User.updateById(u.id, {
        address: '0xAddress',
        email: '0x@email.com',
      });
      await request(app.getHttpServer())
        .get(`/v1/users/0xAddress`)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.object).toEqual('user');
          expect(res.body.data.id).toEqual(u.id);
          expect(res.body.data.email).toBeUndefined();
        });
    });

    it('should return 200 and full user data when token was provided', async () => {
      await User.updateById(u.id, {
        address: '0xAddress',
        email: '0x@email.com',
      });
      await request(app.getHttpServer())
        .get(`/v1/users/0xAddress`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.object).toEqual('user');
          expect(res.body.data.id).toEqual(u.id);
          expect(res.body.data.email).toEqual('0x@email.com');
        });
    });
  });

  describe('.updatePaymentMethod', function () {
    it('should return 401 no access token was provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/users/payment-method`)
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
        .put(`/v1/users/payment-method`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: { message: 'method is required', type: 'invalid_request_error' },
        });
    });

    it('should return 400 method provided was invalid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/users/payment-method`)
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
      const liq = await Liquidity.create({ provider: u.address });
      const liq2 = await Liquidity.create({ provider: u.address });
      await request(app.getHttpServer())
        .put(`/v1/users/payment-method`)
        .set('Authorization', 'bearer ' + token)
        .send({ method: 'bank_transfer' })
        .expect(200)
        .expect({ data: { ok: true } });
      const user = await User.getById(u.id);
      expect(user.paymentMethod).toEqual('bank_transfer');
      const updLiq = await Liquidity.getById(liq.id);
      expect(updLiq.paymentMethod).toEqual('bank_transfer');
      const updLiq2 = await Liquidity.getById(liq2.id);
      expect(updLiq2.paymentMethod).toEqual('bank_transfer');
    });
  });

  describe('.updateCountry', function () {
    it('should return 401 no access token was provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/users/country`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 country was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/users/country`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: { message: 'country is required', type: 'invalid_request_error' },
        });
    });

    it('should return 400 the country provided was invalid', async () => {
      await request(app.getHttpServer())
        .put(`/v1/users/country`)
        .set('Authorization', 'bearer ' + token)
        .send({ country: 'invalid' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'country is invalid',
          },
        });
    });

    it('should return 200 when the country provided was valid', async () => {
      const liq = await Liquidity.create({ provider: u.address });
      const liq2 = await Liquidity.create({ provider: u.address });
      await request(app.getHttpServer())
        .put(`/v1/users/country`)
        .set('Authorization', 'bearer ' + token)
        .send({ country: 'spain' })
        .expect(200)
        .expect({ data: { ok: true } });
      const user = await User.getById(u.id);
      expect(user.country).toEqual(getNameList()['spain']);
      const updLiq = await Liquidity.getById(liq.id);
      expect(updLiq.country).toEqual('ES');
      const updLiq2 = await Liquidity.getById(liq2.id);
      expect(updLiq2.country).toEqual('ES');
    });
  });
});

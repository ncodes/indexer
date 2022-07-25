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
    u = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.me', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/me`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 200 and authenticated user when token was provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/me`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.object).toEqual('user');
          expect(res.body.data.id).toEqual(u.id);
        });
    });
  });
});

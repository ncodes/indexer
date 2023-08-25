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
import { UsersController } from './users.controller';
import { randStr } from '../../common/common';
import { UserService } from './user.service';
import { MetadataService } from '../../services/metadata/metadata.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

// mock metadata service
const mockMetadataTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return { tryToUsd: mockMetadataTryToUsd };
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
      providers: [ConfigService, UserService, MetadataService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
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
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
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

    it('should return 200 and zero User when user with matching address was not found but no404=true', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/0xAddress2`)
        .query({ no404: true })
        .expect(200)
        .expect({
          data: {
            address: '0xAddress2',
            volume: '0',
            volumeUsd: 0,
            totalSwaps: 0,
            completionRate: 0,
            badges: [],
          },
        });
    });

    it('should return 401 when provided address did not match auth token user address', async () => {
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
      const mockExtendUser = jest.spyOn(app.get(UserService), 'extendUser').mockResolvedValue(undefined);
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
          expect(mockExtendUser).toBeCalledTimes(1);
        });
    });

    it('should return 200 and full user data when token was provided', async () => {
      const mockExtendUser = jest.spyOn(app.get(UserService), 'extendUser').mockResolvedValue(undefined);
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
          expect(mockExtendUser).toBeCalledTimes(1);
        });
    });
  });
});

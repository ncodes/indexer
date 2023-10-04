import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { FilesController } from './files.controller';
import { SupportedNetworks } from '../../network/common';
import { FilesService } from './files.service';
import * as request from 'supertest';
import * as path from 'path';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import { makeSession } from '../auth/utils';
import { randStr } from '../../common/common';
import Swap from '../../models/swap';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('FilesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = SupportedNetworks.Ethereum;
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
      controllers: [FilesController],
      providers: [ConfigService, FilesService],
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
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.upload', () => {
    it('should return 401 when authorization was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/unknown/0`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/unknown/0`)
        .set('Authorization', 'bearer xyz')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 400 when file was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/unknown/0`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'file is required' },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/unknown/0`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'network is unknown' },
        });
    });

    it('should return 400 when order ID is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/abc12`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'order id is not a number' },
        });
    });

    it('should return 400 when swap is unknown', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/0`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'swap not found' },
        });
    });

    it('should return 401 when authenticated user is neither a swap counterparty or active dispute draftee', async () => {
      await Swap.create({ network: net, orderId: 1 });
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/1`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(401)
        .expect({
          error: { type: 'authentication_error', message: 'you are not allowed to upload files for this swap' },
        });
    });

    it('should return 200 on successful upload and when auth user is provider', async () => {
      await Swap.create({ network: net, orderId: 1, provider: u.address });
      jest.spyOn(app.get(FilesService), 'upload').mockResolvedValue('0xHash');
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/1`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(201)
        .expect({
          data: { hash: '0xHash' },
        });
    });

    it('should return 200 on successful upload and when auth user is taker', async () => {
      await Swap.create({ network: net, orderId: 1, taker: u.address });
      jest.spyOn(app.get(FilesService), 'upload').mockResolvedValue('0xHash');
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/1`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(201)
        .expect({
          data: { hash: '0xHash' },
        });
    });

    it('should return 200 on successful upload and when auth user is an active dispute draftee', async () => {
      await Swap.create({ network: net, orderId: 1 });
      await Dispute.create({ network: net, orderId: 1, disputeId: 0 });
      await Draft.create({ network: net, orderId: 1, disputeIndex: 0, owner: u.address });
      jest.spyOn(app.get(FilesService), 'upload').mockResolvedValue('0xHash');
      await request(app.getHttpServer())
        .post(`/v1/files/upload/${net}/1`)
        .set('Authorization', 'bearer ' + token)
        .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
        .expect(201)
        .expect({
          data: { hash: '0xHash' },
        });
    });
  });
});

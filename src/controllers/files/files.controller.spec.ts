import { ChainNames } from '@jointlabs/chains-info';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as path from 'path';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Swap from '../../models/swap';
import User from '../../models/user';
import { makeSession } from '../auth/utils';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('FilesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
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

    describe('image upload', () => {
      it(`should return 400 when the uploaded file's type is not supported`, async () => {
        cfgObj['app.fileUpload.allowedImageTypes'] = 'image/abc';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file type is not valid (only jpg, jpeg, png are allowed)',
            },
          });
      });

      it(`should return 400 when the uploaded file's size is too large`, async () => {
        cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpg';
        cfgObj['app.fileUpload.maxImageSize'] = '1';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/image.jpg'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file type is not valid (only jpg, jpeg, png are allowed)',
            },
          });
      });
    });

    describe('video upload', () => {
      it(`should return 400 when the uploaded file's type is not supported`, async () => {
        cfgObj['app.fileUpload.allowedVideoTypes'] = 'video/abc';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/video.mp4'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file type is not valid (only mp4, mov, wmv, webm are allowed)',
            },
          });
      });

      it(`should return 400 when the uploaded file's size is too large`, async () => {
        cfgObj['app.fileUpload.allowedVideoTypes'] = 'video/mp4';
        cfgObj['app.fileUpload.maxVideoSize'] = '1';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/video.mp4'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file limit was exceeded (max: 30MB)',
            },
          });
      });
    });

    describe('document upload', () => {
      it(`should return 400 when the uploaded file's type is not supported`, async () => {
        cfgObj['app.fileUpload.allowedDocTypes'] = 'application/abc';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/doc.pdf'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file type is not supported',
            },
          });
      });

      it(`should return 400 when the uploaded file's size is too large`, async () => {
        cfgObj['app.fileUpload.allowedDocTypes'] = 'application/pdf';
        cfgObj['app.fileUpload.maxDocSize'] = '1';
        await request(app.getHttpServer())
          .post(`/v1/files/upload/${net}/0`)
          .set('Authorization', 'bearer ' + token)
          .attach('file', path.resolve(__dirname, './testdata/doc.pdf'))
          .expect(400)
          .expect({
            error: {
              type: 'invalid_request_error',
              message: 'file limit was exceeded (max: 10MB)',
            },
          });
      });
    });

    it('should return 400 when swap is unknown', async () => {
      cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpeg';
      cfgObj['app.fileUpload.maxImageSize'] = '11534336';
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
      cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpeg';
      cfgObj['app.fileUpload.maxImageSize'] = '11534336';
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
      cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpeg';
      cfgObj['app.fileUpload.maxImageSize'] = '11534336';
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
      cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpeg';
      cfgObj['app.fileUpload.maxImageSize'] = '11534336';
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
      cfgObj['app.fileUpload.allowedImageTypes'] = 'image/jpeg';
      cfgObj['app.fileUpload.maxImageSize'] = '11534336';
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

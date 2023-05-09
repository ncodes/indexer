import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import * as moment from 'moment';
import * as request from 'supertest';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/DBService';
import Session from '../../models/session';
import User from '../../models/user';
import { AuthController } from './auth.controller';
import { ErrorMessages } from '../../common/responses/responses';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

export function makeMsg(address: string, email: string, timestamp: string) {
  return `Welcome to FiatX!

--
Address: "${address}"
Email: ${email}
Timestamp: ${timestamp}`;
}

describe('AuthController', () => {
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

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AuthController],
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
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
  });

  describe('.auth', () => {
    it('should return error and status=400 when signature was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'signature is required',
            param: 'sig',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=400 when message was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({ sig: 'sign' })
        .expect(400)
        .expect({
          error: {
            message: 'message is required',
            param: 'msg',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=401 when signature failed verification', async () => {
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({ sig: 'signature', msg: 'message' })
        .expect(401)
        .expect({
          error: {
            param: 'sig',
            type: 'authentication_error',
            message: 'signature is invalid or expired',
          },
        });
    });

    it('should return error and status=400 when email is not valid', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg(
          '0x14791697260E4c9A71f18484C9f997B308e59325',
          'person-gmail.com',
          moment().toISOString(),
        ),
      );
      const sig = await wallet.signMessage(msg.toString());
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({ sig, msg: msg.toString('hex') })
        .expect(400)
        .expect({
          error: {
            param: 'email',
            type: 'invalid_request_error',
            message: 'email is not valid',
          },
        });
    });

    it('should return error and status=401 when signed message includes an address different from the recovered address from the signature', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg(
          '0x14791697260E4c9A71f18484C9f997B308e59327',
          'person@gmail.com',
          moment().toISOString(),
        ),
      );
      const sig = await wallet.signMessage(msg.toString());
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({ sig, msg: msg.toString('hex') })
        .expect(401)
        .expect({
          error: {
            param: 'sig',
            type: 'authentication_error',
            message: 'signature is invalid or expired',
          },
        });
    });

    it('should return error and status=401 when signed message includes expired timestamp', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg(wallet.address, 'person@gmail.com', moment().subtract('5', 'm').toISOString()),
      );
      const sig = await wallet.signMessage(msg.toString());
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({ sig, msg: msg.toString('hex'), messengerPublicKey: 'abc' })
        .expect(401)
        .expect({
          error: {
            param: 'sig',
            type: 'authentication_error',
            message: 'signature is invalid or expired',
          },
        });
    });

    it('should return status=201, create user, session and return session token', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
      const sig = await wallet.signMessage(msg.toString());

      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({
          sig,
          msg: msg.toString('hex'),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.token).toBeDefined();
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
        });

      const session = await Session.getBySignature(sig);
      expect(session).toBeDefined();
    });

    it('should update existing user when there is a user with matching address', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg(wallet.address, 'person@gmail.com', moment().subtract(1, 's').toISOString()),
      );
      const sig = await wallet.signMessage(msg.toString());
      const existing = await User.create({ address: wallet.address });
      let user: User;
      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({
          sig,
          msg: msg.toString('hex'),
          email: 'person@gmail.com',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.token).toBeDefined();
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
          user = res.body.data.user;
        });
      expect(existing.id).toEqual(user.id);
      expect(user.email).toEqual('person@gmail.com');
    });
  });

  describe('.getAuthorizer', () => {
    it('should return error and status=400 when signature was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/auth/user`)
        .query({})
        .expect(400)
        .expect({
          error: {
            message: 'signature is required',
            param: 'sig',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=400 when message was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/auth/user`)
        .query({ sig: 'sign' })
        .expect(400)
        .expect({
          error: {
            message: 'message is required',
            param: 'msg',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=401 when signature failed verification', async () => {
      await request(app.getHttpServer())
        .get(`/v1/auth/user`)
        .query({ sig: 'signature', msg: 'message' })
        .expect(401)
        .expect({
          error: {
            param: 'sig',
            type: 'authentication_error',
            message: 'signature is invalid or expired',
          },
        });
    });

    it('should return error when no user is associated with the signatory', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
      const sig = await wallet.signMessage(msg.toString());
      await request(app.getHttpServer())
        .get(`/v1/auth/user`)
        .query({ sig, msg: msg.toString('hex') })
        .expect(404)
        .expect({
          error: { message: ErrorMessages.UserNotFound },
        });
    });

    it('should return error when no user is associated with the signatory', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
      const sig = await wallet.signMessage(msg.toString());
      const user = await User.create({ address: wallet.address });
      await request(app.getHttpServer())
        .get(`/v1/auth/user`)
        .query({ sig, msg: msg.toString('hex') })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(user.id);
        });
    });
  });
});

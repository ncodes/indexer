import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ethers } from 'ethers';
import * as moment from 'moment';
import { authenticator, totp } from 'otplib';
import * as request from 'supertest';
import { randStr, sha1 } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { ErrorMessages } from '../../common/responses/responses';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import { NotificationID } from '../../jobs/notifications/common';
import Session from '../../models/session';
import Tap from '../../models/tap';
import User from '../../models/user';
import { JointLinkService } from '../../services/joint_link.service';
import { RedisService } from '../../services/redis/redis.service';
import AirdropService from '../airdrop/airdrop.service';
import { RefereeBonus } from '../airdrop/constants';
import ConvosService from '../convos/convos.service';
import { UserService } from '../users/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { makeSession } from './utils';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const RedisServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

const mockNotify = jest.fn();
const NotifierServiceMock = jest.fn().mockImplementation(() => {
  return {
    notify: mockNotify,
  };
});

const mockCreateLink = jest
  .fn()
  .mockResolvedValue({ url: 'url', normalizedUrl: 'normalizedUrl', shortUrl: 'shortUrl' });
const MockJointLinkService = jest.fn().mockImplementation(() => {
  return {
    createReferralLink: mockCreateLink,
  };
});

export function makeMsg(address: string, email: string, timestamp: string) {
  return `Welcome to App!

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

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
      'app.discord.jointGuildId': '123',
    };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AuthController],
      providers: [
        ConfigService,
        RedisService,
        UserService,
        ConvosService,
        NotificationService,
        JointLinkService,
        AuthService,
        AirdropService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .overrideProvider(NotificationService)
      .useValue(new NotifierServiceMock())
      .overrideProvider(JointLinkService)
      .useValue(new MockJointLinkService())
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
        makeMsg('0x14791697260E4c9A71f18484C9f997B308e59325', 'person-gmail.com', moment().toISOString()),
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
        makeMsg('0x14791697260E4c9A71f18484C9f997B308e59327', 'person@gmail.com', moment().toISOString()),
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
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().subtract('5', 'm').toISOString()));
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

    it('should return status=201, create new user, set refer code, set OTP secret, send OTP message and create no session', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
      const sig = await wallet.signMessage(msg.toString());

      const mockRegDevice = jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({
          sig,
          msg: msg.toString('hex'),
        })
        .expect(201)
        .expect(async (res) => {
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
          expect(mockRegDevice).toBeCalledTimes(1);

          expect(mockNotify.mock.calls[0][0]).toEqual(NotificationID.VerifyNewEmail);
          expect(mockNotify.mock.calls[0][1]).toBeUndefined();
          expect(mockNotify.mock.calls[0][2]).toBeUndefined();
          const data = mockNotify.mock.calls[0][3];
          expect(data.otp).toBeDefined();
          expect(data.otp).toHaveLength(6);
          expect(data.user).toBeDefined();
          expect(data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
          expect(data.user.email).toBeUndefined();
          expect(data.user.emailUnverified).toEqual('person@gmail.com');
          expect(data.user.otpSecret).toBeDefined();

          const user = await User.getById(res.body.data.user.id);
          expect(user).toBeDefined();
          expect(user.refCode).toHaveLength(5);

          const session = await Session.getBySignature(sha1(sig));
          expect(session).not.toBeDefined();
        });
    });

    describe('when user already exist but with no OTP secret', () => {
      it('should return status=201, update new user, set OTP secret, send OTP and create no session', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        let user = await User.create({ address: wallet.address });
        const mockRegDevice = jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
            expect(mockRegDevice).toBeCalledTimes(1);
            expect(mockNotify).toBeCalledTimes(1);

            user = await User.getById(user.id);
            expect(user.otpSecret).toBeDefined();
            expect(user.emailUnverified).toEqual('person@gmail.com');

            const session = await Session.getBySignature(sha1(sig));
            expect(session).not.toBeDefined();
          });
      });
    });

    describe('when user already exist but with same email', () => {
      it('should return status=201, create session and return token', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        let user = await User.create({ address: wallet.address, email: 'person@gmail.com' });
        const mockRegDevice = jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.address.toLowerCase()).toEqual(wallet.address.toLowerCase());
            expect(mockRegDevice).toBeCalledTimes(1);
            expect(mockNotify).toBeCalledTimes(0);

            user = await User.getById(user.id);
            expect(user.otpSecret).toBeDefined();
            expect(user.emailUnverified).toBeNull();

            const session = await Session.getBySignature(sha1(sig));
            expect(session).toBeDefined();
          });
      });
    });

    describe('when user already exist and has no ref code', () => {
      it('should set ref code', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        await User.create({ address: wallet.address, email: 'person@gmail.com' });
        jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.refCode).toHaveLength(5);
          });
      });
    });

    describe('when user already exist and has ref code', () => {
      it('should set ref code', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        await User.create({ address: wallet.address, email: 'person@gmail.com', refCode: 'abcde' });
        jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.refCode).toEqual('abcde');
          });
      });
    });

    describe('when referrer is set', () => {
      it('should set referrer if user did not already exist', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        const referrer = await User.create({ address: '0xReferrer', refCode: '12345' });

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
            refCode: referrer.refCode,
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.referrer).toEqual(referrer.address);
            expect(res.body.data.user.refCode).toHaveLength(5);
            expect(mockCreateLink).toHaveBeenCalledTimes(1);

            const newUserTapBonus = await Tap.getTapCount(res.body.data.user.id);
            expect(newUserTapBonus).toBeDefined();
            expect(newUserTapBonus).toEqual(RefereeBonus.toString());
          });
      });

      it('should not set referrer if user already exist', async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().toISOString()));
        const sig = await wallet.signMessage(msg.toString());

        const user = await User.create({
          address: wallet.address,
          email: 'person@gmail.com',
          refCode: 'abcde',
          referrer: '0x123',
        });
        jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

        const referrer = await User.create({ address: '0xReferrer', refCode: '12345' });

        await request(app.getHttpServer())
          .post(`/v1/auth`)
          .send({
            sig,
            msg: msg.toString('hex'),
            refCode: referrer.refCode,
          })
          .expect(201)
          .expect(async (res) => {
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.referrer).toEqual(user.referrer);
            expect(res.body.data.user.refCode).toHaveLength(5);
          });
      });
    });

    it('should return status=401 if a session exist with matching signature', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(makeMsg(wallet.address, 'person@gmail.com', moment().subtract(1, 's').toISOString()));
      const sig = await wallet.signMessage(msg.toString());
      await Session.create('user_123', sha1(sig));

      jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post(`/v1/auth`)
        .send({
          sig,
          msg: msg.toString('hex'),
          email: 'person@gmail.com',
        })
        .expect(401)
        .expect({
          error: {
            param: 'sig',
            type: 'authentication_error',
            message: 'signature is invalid or expired',
          },
        });
    });
  });

  describe('.verifyEmail', () => {
    it('should return error and status=400 when user ID was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'user ID is required',
            param: 'userId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=400 when OTP was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({
          userId: 'user_123',
        })
        .expect(400)
        .expect({
          error: {
            message: 'otp is required',
            param: 'otp',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error and status=400 when user was not found', async () => {
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({
          userId: 'user_123',
          otp: '123456',
        })
        .expect(404)
        .expect({
          error: {
            message: 'user not found',
          },
        });
    });

    it('should return error and status=400 when no unverified email', async () => {
      const user = await User.create({ emailUnverified: null });
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({
          userId: user.id,
          otp: '123456',
        })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'email is already verified',
          },
        });
    });

    it('should return error and status=400 when no unverified email', async () => {
      const otpSecret = authenticator.generateSecret();
      const user = await User.create({ emailUnverified: 'person@gmail.com', otpSecret });
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({
          userId: user.id,
          otp: '123456',
        })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'invalid otp',
          },
        });
    });

    it('should status=200 and set email and nullify emailVerified field', async () => {
      const otpSecret = authenticator.generateSecret();
      const user = await User.create({ emailUnverified: 'person@gmail.com', otpSecret });
      await request(app.getHttpServer())
        .put(`/v1/auth/verify-email`)
        .send({
          userId: user.id,
          otp: totp.generate(otpSecret),
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.token).toBeDefined();
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.email).toEqual('person@gmail.com');
          expect(res.body.data.user.emailUnverified).toBeNull();
        });
    });
  });

  describe('.deleteSession', () => {
    it('should return error and status=401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/auth/session`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return error and status=401 when token is invalid', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/auth/session`)
        .set('Authorization', 'bearer abc')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should 200 and delete current session when `all` query param is unset', async () => {
      let session = await Session.getByUserId(u.id);
      expect(session).toBeDefined();

      let otherSession = await Session.create(u.id, randStr());

      await request(app.getHttpServer())
        .delete(`/v1/auth/session`)
        .set('Authorization', 'bearer ' + token)
        .expect(200);

      session = await Session.getById(session.id);
      expect(session).toBeUndefined();

      otherSession = await Session.getById(otherSession.id);
      expect(otherSession).toBeDefined();
    });

    it('should 200 and delete all session when `all` query param is set', async () => {
      let session = await Session.getByUserId(u.id);
      expect(session).toBeDefined();

      let otherSession = await Session.create(u.id, randStr());

      await request(app.getHttpServer())
        .delete(`/v1/auth/session`)
        .query({ all: 'true' })
        .set('Authorization', 'bearer ' + token)
        .expect(200);

      session = await Session.getById(session.id);
      expect(session).toBeUndefined();

      otherSession = await Session.getById(otherSession.id);
      expect(otherSession).toBeUndefined();
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

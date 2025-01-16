import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import CacheService from '../../cacher/cache.service';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Offer from '../../models/offer';
import Swap from '../../models/swap';
import User from '../../models/user';
import NetworkService from '../../network/network.service';
import EtherScanService from '../../services/etherscan.service';
import { JointLinkService } from '../../services/joint_link.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis/redis.service';
import AirdropService from '../airdrop/airdrop.service';
import TapService from '../airdrop/tap.service';
import { makeSession } from '../auth/utils';
import ConvosService from '../convos/convos.service';
import { UserService } from './user.service';
import { UsersController } from './users.controller';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockMetadataTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return { tryToUsd: mockMetadataTryToUsd };
});

const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {
    getContracts: jest.fn().mockImplementation(() => {
      return {};
    }),
  };
});

const RedisServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('UsersController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const address2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
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
      providers: [
        ConfigService,
        NetworkService,
        UserService,
        AirdropService,
        MetadataService,
        ConvosService,
        JointLinkService,
        RedisService,
        CacheService,
        TapService,
        EtherScanService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .overrideProvider(EtherScanService)
      .useValue(new (jest.fn())())
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

  describe('.get', () => {
    it('should return 404 when user with matching address was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/${address2}`)
        .send({})
        .expect(404)
        .expect({
          error: { message: 'user not found' },
        });
    });

    it('should return 200 and zero User when user with matching address was not found but no404=true', async () => {
      await request(app.getHttpServer())
        .get(`/v1/users/${address2}`)
        .query({ no404: true })
        .expect(200)
        .expect({
          data: {
            address: address2,
            volume: '0',
            volumeUsd: 0,
            totalSwaps: 0,
            completionRate: 0,
            badges: [],
          },
        });
    });

    describe('when address is provided as param', () => {
      it('should return 401 when provided address did not match auth token user address', async () => {
        await User.updateById(u.id, {
          address,
          email: '0x@email.com',
        });
        await request(app.getHttpServer())
          .get(`/v1/users/${address2}`)
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
    });

    describe('when userID is provided as param', () => {
      it('should return 401 when provided user ID did not match auth token user ID', async () => {
        await User.updateById(u.id, {
          email: '0x@email.com',
        });
        await request(app.getHttpServer())
          .get(`/v1/users/user123`)
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
    });

    it('should return 200 and de-sensitized user data when token was not provided', async () => {
      const mockExtendUser = jest.spyOn(app.get(UserService), 'extendUser').mockResolvedValue(undefined);
      await User.updateById(u.id, {
        address,
        email: '0x@email.com',
      });
      await request(app.getHttpServer())
        .get(`/v1/users/${address}`)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.object).toEqual('user');
          expect(res.body.data.id).toEqual(u.id);
          expect(res.body.data.email).toBeUndefined();
          expect(mockExtendUser).toBeCalledTimes(1);
        });
    });

    describe('when address is provided as param', () => {
      it('should return 200 and full user data when token was provided', async () => {
        const mockExtendUser = jest.spyOn(app.get(UserService), 'extendUser').mockResolvedValue(undefined);
        await User.updateById(u.id, {
          address,
          email: '0x@email.com',
        });
        await request(app.getHttpServer())
          .get(`/v1/users/${address}`)
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

    describe('when userID is provided as param', () => {
      it('should return 200 and full user data when token was provided', async () => {
        const mockExtendUser = jest.spyOn(app.get(UserService), 'extendUser').mockResolvedValue(undefined);
        await User.updateById(u.id, {
          email: '0x@email.com',
        });
        await request(app.getHttpServer())
          .get(`/v1/users/${u.id}`)
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

  describe('.registerDevice', () => {
    it('should return 401 when authorization header is missing', async () => {
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .post(`/v1/users/register-device`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 201 on success', async () => {
      jest.spyOn(app.get(UserService), 'registerDevice').mockResolvedValue(undefined);
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .post(`/v1/users/register-device`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: 'email' })
        .expect(201)
        .expect({ data: { ok: true } });
    });
  });

  describe('.unregisterDevice', () => {
    it('should return 401 when authorization header is missing', async () => {
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .delete(`/v1/users/unregister-device`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when type is not provided', async () => {
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .delete(`/v1/users/unregister-device`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'device type is required',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when device type is unknown', async () => {
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .delete(`/v1/users/unregister-device`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: 'unknown' })
        .expect(400)
        .expect({
          error: {
            message: 'device type is unknown',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 on success', async () => {
      jest.spyOn(app.get(UserService), 'unregisterDevice').mockResolvedValue(true);
      await User.updateById(u.id, { address, email: '0x@email.com' });
      await request(app.getHttpServer())
        .delete(`/v1/users/unregister-device`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: 'email' })
        .expect(200)
        .expect({ data: { success: true } });
    });
  });

  describe('.logOnlineStatus', () => {
    it('should return 401 when authorization header is missing', async () => {
      await request(app.getHttpServer())
        .post(`/v1/users/log-status`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/users/log-status`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return true when orderId or offerId was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/users/log-status`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net: 'ethereum',
        })
        .expect(201)
        .expect({
          data: { ok: true },
        });
    });

    describe('orderId was provided', () => {
      it('should return true when user is a counterpart of orderId', async () => {
        const order = await Swap.create({ network: net, orderId: 1, provider: u.address });
        await request(app.getHttpServer())
          .post(`/v1/users/log-status`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net,
            orderId: order.orderId,
          })
          .expect(201)
          .expect({
            data: { ok: true },
          });
      });

      it('should return true when user is a recent dispute draftee of the order', async () => {
        const order = await Swap.create({ network: net, orderId: 1 });
        const dispute = await Dispute.create({
          network: net,
          orderId: order.orderId,
          creator: u.address,
          defendant: '0xDefendant',
          disputeId: 1,
        });
        await Draft.create({
          network: net,
          orderId: order.orderId,
          owner: u.address,
          disputeIndex: dispute.disputeId,
        });
        await request(app.getHttpServer())
          .post(`/v1/users/log-status`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net,
            orderId: order.orderId,
          })
          .expect(201)
          .expect({
            data: { ok: true },
          });
      });
    });

    it('should return false when order does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/v1/users/log-status`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          orderId: 1,
        })
        .expect(200)
        .expect({
          data: { ok: false },
        });
    });

    it('should return false when user not a counterparty or recent dispute draftee of the order', async () => {
      const order = await Swap.create({ network: net, orderId: 1 });
      const dispute = await Dispute.create({
        network: net,
        orderId: order.orderId,
        creator: '0xCreator',
        defendant: '0xDefendant',
        disputeId: 1,
      });
      await Draft.create({
        network: net,
        orderId: order.orderId,
        owner: '0xDraftee',
        disputeIndex: dispute.disputeId,
      });
      await request(app.getHttpServer())
        .post(`/v1/users/log-status`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net,
          orderId: order.orderId,
        })
        .expect(200)
        .expect({
          data: { ok: false },
        });
    });

    describe('offerId was provided', () => {
      it('should return true when user is the provider', async () => {
        const offer = await Offer.create({ network: net, offerId: 1, provider: u.address, creator: '0xCreator' });
        await request(app.getHttpServer())
          .post(`/v1/users/log-status`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net,
            offerId: offer.offerId,
          })
          .expect(201)
          .expect({
            data: { ok: true },
          });
      });

      it('should return true when user is the creator', async () => {
        const offer = await Offer.create({ network: net, offerId: 1, creator: u.address, provider: '0xProvider' });
        await request(app.getHttpServer())
          .post(`/v1/users/log-status`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net,
            offerId: offer.offerId,
          })
          .expect(201)
          .expect({
            data: { ok: true },
          });
      });

      it('should return false when offer does not exist', async () => {
        await request(app.getHttpServer())
          .post(`/v1/users/log-status`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net,
            offerId: 1,
          })
          .expect(200)
          .expect({
            data: { ok: false },
          });
      });
    });
  });

  describe('.computeAlloc', () => {
    it('should return correct allocation', () => {
      cfgObj['app.claimStartTime'] = moment().subtract(2, 'week').unix();
      let alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(8_000);

      cfgObj['app.claimStartTime'] = moment().subtract(5, 'week').unix();
      alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(5_000);

      cfgObj['app.claimStartTime'] = moment().subtract(6, 'week').unix();
      alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(5_000);

      cfgObj['app.claimStartTime'] = moment().subtract(7, 'week').unix();
      alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(5_000);

      cfgObj['app.claimStartTime'] = null;
      alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(10_000);

      delete cfgObj['app.claimStartTime'];
      alloc = app.get(UsersController).computeAlloc();
      expect(alloc).toEqual(10_000);
    });
  });
});

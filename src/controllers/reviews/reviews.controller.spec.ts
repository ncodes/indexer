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
import { ReviewsController } from './reviews.controller';
import Swap from '../../models/swap';
import Liquidity from '../../models/liquidity';
import Review from '../../models/reviews';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('ReviewsController', () => {
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
      controllers: [ReviewsController],
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
  let u2: User;
  let token: string;
  let token2: string;
  const net = 'ethereum';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    u2 = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
    token2 = await makeSession(
      u2,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.create', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/reviews/abc`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when `satisfied` property is unset', async () => {
      await request(app.getHttpServer())
        .post(`/v1/reviews/abc`)
        .send({})
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'set to true or false',
            param: 'satisfied',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when swap was not found', async () => {
      await request(app.getHttpServer())
        .post(`/v1/reviews/abc`)
        .send({ satisfied: true })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'swapId',
            type: 'invalid_request_error',
            message: 'swap order not found',
          },
        });
    });

    it('should return 401 when auth user is not a provider or taker', async () => {
      await User.updateById(u.id, { address: '0xAddress' });
      const swap = await Swap.create({});
      await request(app.getHttpServer())
        .post(`/v1/reviews/${swap.id}`)
        .send({ satisfied: true })
        .set('Authorization', 'bearer ' + token)
        .expect(401)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'not a participant',
          },
        });
    });

    it('should return 201 on success', async () => {
      await User.updateById(u.id, { address: '0xAddress' });
      await User.updateById(u2.id, { address: '0xTaker' });
      const swap = await Swap.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xAddress',
        taker: '0xTaker',
        released: true,
      });
      let liq1 = await Liquidity.create({
        network: net,
        marketId: '0xMarket',
        provider: '0xAddress',
      });
      let liq2 = await Liquidity.create({
        network: net,
        marketId: '0xMarket2',
        provider: '0xAddress',
      });
      await request(app.getHttpServer())
        .post(`/v1/reviews/${swap.id}`)
        .send({ satisfied: true })
        .set('Authorization', 'bearer ' + token2)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.object).toEqual('review');
          expect(res.body.data.satisfied).toBeTruthy();
          expect(res.body.data.reviewerId).toEqual(u2.id);
          expect(res.body.data.reviewed).toEqual(swap.provider);
        });

      liq1 = await Liquidity.getById(liq1.id);
      expect(liq1.satisfactoryRate).toEqual(100);
      liq2 = await Liquidity.getById(liq2.id);
      expect(liq2.satisfactoryRate).toEqual(100);
    });
  });

  describe('.list', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reviews/abc`)
        .query({})
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
        .get(`/v1/reviews/abc`)
        .query({})
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

    it('should return 400 when network was unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reviews/abc`)
        .query({ net: 'net' })
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

    it('should return 200 and correct result on success', async () => {
      const rev1 = await Review.create({ network: net, reviewed: '0xAddress' });
      await request(app.getHttpServer())
        .get(`/v1/reviews/0xAddress`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(rev1.id);
        });
    });

    describe('with limit set', () => {
      it('should return 200 and correct result on success', async () => {
        await Review.create({ network: net, reviewed: '0xAddress' });
        const rev2 = await Review.create({
          network: net,
          reviewed: '0xAddress',
        });
        await request(app.getHttpServer())
          .get(`/v1/reviews/0xAddress`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(rev2.id);
          });
      });
    });

    describe('with limit and offset set', () => {
      it('should return 200 and correct result on success', async () => {
        const rev1 = await Review.create({
          network: net,
          reviewed: '0xAddress',
        });
        await Review.create({ network: net, reviewed: '0xAddress' });
        await request(app.getHttpServer())
          .get(`/v1/reviews/0xAddress`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(rev1.id);
          });
      });
    });

    describe('with cunt set', () => {
      it('should return 200 and correct result on success', async () => {
        await Review.create({ network: net, reviewed: '0xAddress' });
        await Review.create({ network: net, reviewed: '0xAddress' });
        await request(app.getHttpServer())
          .get(`/v1/reviews/0xAddress`)
          .query({ net, count: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({ data: { count: '2' } });
      });
    });
  });

  describe('.getStats', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/reviews/abc/stats`)
        .query({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    describe('when address has no review', () => {
      it('should return `satisfactoryRate` = 0', async () => {
        await request(app.getHttpServer())
          .get(`/v1/reviews/abc/stats`)
          .query({})
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              numReceivedReviews: 0,
              numSatisfiedReceived: 0,
              satisfactoryRate: 0,
            },
          });
      });
    });

    describe('when address has 1 satisfied review out of two reviews', () => {
      it('should return `satisfactoryRate` = 0', async () => {
        await Review.create({ reviewed: '0xAddress', satisfied: true });
        await Review.create({ reviewed: '0xAddress', satisfied: false });
        await request(app.getHttpServer())
          .get(`/v1/reviews/0xAddress/stats`)
          .query({})
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect({
            data: {
              numReceivedReviews: 2,
              numSatisfiedReceived: 1,
              satisfactoryRate: 50,
            },
          });
      });
    });
  });
});

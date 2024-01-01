import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Point, { PointAction } from '../../models/point';
import User from '../../models/user';
import { ReferralController } from './referral.controller';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('ReferralController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj: Record<string, string> = {};

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

    cfgObj = { 'auth.jwtSecret': 'secret_secret', 'app.rootAdminUser': 'test', 'app.rootAdminPass': 'test' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [ReferralController],
      providers: [ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe(CommonValidationPipeOpt));
    await app.init();
  });

  let u: User;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address: '0xAddress' });
  });

  describe('.getInfo', () => {
    it('should return 400 when address is not associated with a user', async () => {
      await request(app.getHttpServer())
        .get(`/v1/referrals/unknown/info`)
        .expect(404)
        .expect({
          error: {
            message: 'user not found',
          },
        });
    });

    it('should return 200 and zero referred users when address is associated with a user but no users were referred', async () => {
      u = await User.updateById(u.id, { refCode: 'refCode' });
      await request(app.getHttpServer())
        .get(`/v1/referrals/${u.address}/info`)
        .expect(200)
        .expect({
          data: {
            refCode: u.refCode,
            numReferred: 0,
            totalPoints: '0',
            referred: [],
          },
        });
    });

    it('should return 200 and number of referred users when address is associated with a user and users were referred', async () => {
      u = await User.updateById(u.id, { refCode: 'refCode' });
      await User.create({ referrer: u.address, address: '0xAddress2' });
      await User.create({ referrer: u.address, address: '0xAddress3' });
      await Point.create({ point: '100', address: u.address, referrer: u.address });
      await Point.create({ point: '100', address: u.address, referrer: u.address });
      await request(app.getHttpServer())
        .get(`/v1/referrals/${u.address}/info`)
        .expect(200)
        .expect({
          data: {
            refCode: u.refCode,
            numReferred: 2,
            totalPoints: '200',
            referred: ['0xAddress2', '0xAddress3'],
          },
        });
    });
  });

  describe('.getLeaderboard', () => {
    it('should return 400 when referrer was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/referrals/leaderboard`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'referrer is required',
            param: 'referrer',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return empty result when no point has been created', async () => {
      await request(app.getHttpServer())
        .get(`/v1/referrals/leaderboard`)
        .query({
          referrer: '0xReferrer',
        })
        .expect(200)
        .expect({ data: { points: [], total: 0 } });
    });

    it('should return correct results when two different referees have points', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        referee: '0xAddress',
        address: '0xReferrer',
        referrer: '0xReferrer',
        point: '200',
        action: PointAction.Generic,
      });

      const p2 = await Point.create({
        network: 'ethereum',
        name: 'point_2',
        referee: '0xAddress2',
        address: '0xReferrer',
        referrer: '0xReferrer',
        point: '100',
        action: PointAction.Generic,
      });

      await Point.create({
        network: 'ethereum',
        name: 'point_2',
        referee: '0xAddress2',
        address: '0xReferrer2',
        referrer: '0xReferrer2',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/referrals/leaderboard`)
        .query({
          referrer: '0xReferrer',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(2);
          expect(res.body.data.points.length).toBe(2);
          expect(p1.address).toBe(res.body.data.points[0].address);
          expect(p2.address).toBe(res.body.data.points[1].address);
          expect(p1.point).toBe(res.body.data.points[0].totalPoints);
          expect(p2.point).toBe(res.body.data.points[1].totalPoints);
        });
    });

    it('should return correct results when a referee has multiple points', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        referee: '0xAddress',
        address: '0xReferrer',
        referrer: '0xReferrer',
        point: '200',
        action: PointAction.Generic,
      });

      await Point.create({
        network: 'ethereum',
        name: 'point_2',
        referee: '0xAddress',
        address: '0xReferrer',
        referrer: '0xReferrer',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/referrals/leaderboard`)
        .query({
          referrer: '0xReferrer',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(1);
          expect(res.body.data.points.length).toBe(1);
          expect(p1.address).toBe(res.body.data.points[0].address);
          expect(p1.referee).toBe(res.body.data.points[0].referee);
          expect('300').toBe(res.body.data.points[0].totalPoints);
        });
    });
  });

  it('should return correct results when referee query is provided', async () => {
    const p1 = await Point.create({
      network: 'ethereum',
      name: 'point_1',
      referee: '0xAddress',
      address: '0xReferrer',
      referrer: '0xReferrer',
      point: '200',
      action: PointAction.Generic,
    });

    await Point.create({
      network: 'ethereum',
      name: 'point_2',
      referee: '0xAddress2',
      address: '0xReferrer',
      referrer: '0xReferrer',
      point: '100',
      action: PointAction.Generic,
    });

    await request(app.getHttpServer())
      .get(`/v1/referrals/leaderboard`)
      .query({ referrer: '0xReferrer', referee: '0xAddress' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.total).toBe(1);
        expect(res.body.data.points.length).toBe(1);
        expect(p1.referee).toBe(res.body.data.points[0].referee);
        expect(p1.address).toBe(res.body.data.points[0].address);
        expect(res.body.data.points[0].rank).toBe(1);
      });
  });

  it('should return correct results when limit query is provided', async () => {
    const p1 = await Point.create({
      network: 'ethereum',
      name: 'point_1',
      referee: '0xAddress',
      address: '0xReferrer',
      referrer: '0xReferrer',
      point: '200',
      action: PointAction.Generic,
    });

    await Point.create({
      network: 'ethereum',
      name: 'point_2',
      referee: '0xAddress2',
      address: '0xReferrer',
      referrer: '0xReferrer',
      point: '100',
      action: PointAction.Generic,
    });

    await request(app.getHttpServer())
      .get(`/v1/referrals/leaderboard`)
      .query({ referrer: '0xReferrer', limit: 1 })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.total).toBe(2);
        expect(res.body.data.points.length).toBe(1);
        expect(p1.referee).toBe(res.body.data.points[0].referee);
        expect(p1.address).toBe(res.body.data.points[0].address);
      });
  });

  describe('.getLatestPoints', () => {
    it("should return error when 'from' is invalid", async () => {
      await request(app.getHttpServer())
        .get(`/v1/referrals/latest`)
        .query({ from: 'invalid' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a valid ISO8601 date',
            param: 'from',
            type: 'invalid_request_error',
          },
        });
    });

    it("should return error when 'from' is invalid", async () => {
      await request(app.getHttpServer())
        .get(`/v1/referrals/latest`)
        .query({ from: '2021-01-01T00:00:00Z' })
        .expect(400)
        .expect({
          error: {
            message: 'referrer address is required',
            param: 'referrer',
            type: 'invalid_request_error',
          },
        });
    });

    it("should return correct results when 'from' is valid", async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        referrer: '0xReferrer',
        address: '0xReferrer',
        referee: '0xReferee',
        point: '200',
        action: PointAction.Generic,
        createdAt: '2021-01-01T00:00:00Z',
      });

      const p2 = await Point.create({
        network: 'ethereum',
        name: 'point_2',
        referrer: '0xReferrer',
        address: '0xReferrer',
        referee: '0xReferee2',
        point: '100',
        action: PointAction.Generic,
        createdAt: '2021-01-02T00:00:00Z',
      });

      await request(app.getHttpServer())
        .get(`/v1/referrals/latest`)
        .query({ from: '2021-01-02T00:00:00Z', referrer: '0xReferrer3' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(0);
        });

      await request(app.getHttpServer())
        .get(`/v1/referrals/latest`)
        .query({ from: '2021-01-01T00:00:00Z', referrer: '0xReferrer' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(p2.address).toBe(res.body.data[0].address);
        });

      await request(app.getHttpServer())
        .get(`/v1/referrals/latest`)
        .query({ referrer: '0xReferrer' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(p2.address).toBe(res.body.data[0].address);
          expect(p1.address).toBe(res.body.data[1].address);
        });
    });
  });
});

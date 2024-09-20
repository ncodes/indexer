import { getPaymentMethod } from '@jointlabs/meta';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import PayRouterOrg from '../../models/pay_router_org';
import PayRouterRoute from '../../models/pay_router_route';
import PaymentMethod from '../../models/payment_method';
import User from '../../models/user';
import { makeSession } from '../auth/utils';
import { RoutesController } from './routes.controller';

jest.mock('@jointlabs/meta', () => ({
  ...jest.requireActual('@jointlabs/meta'),
  getPaymentMethod: jest.fn(),
}));

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('RoutesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};
  const net = 'ethereum';

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
      controllers: [RoutesController],
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
    u = await User.create({ role: Roles.User, address: '0xUser' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.getRoutes', () => {
    beforeEach(async () => {
      await PayRouterOrg.create({ network: net, name: 'Chase Bank', orgId: 1 });
      await PayRouterOrg.create({ network: net, name: 'Bank of America', orgId: 2 });
      await PayRouterOrg.create({ network: net, name: 'Wells Fargo', orgId: 3 });
      await PayRouterOrg.create({ network: net, name: 'CitiBank', orgId: 4 });
      await PayRouterOrg.create({ network: net, name: 'Capital One', orgId: 5 });
      await PayRouterOrg.create({ network: net, name: 'HSBC', orgId: 6 });

      const paymentMethods = [
        { id: 1, name: 'Chase Bank', type: 1, regions: ['US'] },
        { id: 2, name: 'Bank of America', type: 1, regions: ['US'] },
        { id: 3, name: 'Wells Fargo', type: 1, regions: ['US'] },
        { id: 4, name: 'CitiBank', type: 1, regions: ['US', 'GB', 'AU', 'IN', 'SG', 'NG'] },
        { id: 5, name: 'Capital One', type: 1, regions: ['US'] },
        { id: 6, name: 'HSBC', type: 1, regions: ['GB', 'US', 'HK', 'AU', 'IN', 'NG'] },
      ];

      (getPaymentMethod as jest.Mock).mockImplementation((name: string) => {
        return paymentMethods.find((pm) => pm.name === name);
      });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/routes/NG/3`)
        .query({ net: 'unknown' })
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return correct routes for destination org 3', async () => {
      const paymentMethodId = 'pm_123';
      const r1 = await PayRouterRoute.create({ network: net, sourceOrgId: 1, destOrgId: 3, paymentMethodId });
      const r2 = await PayRouterRoute.create({ network: net, sourceOrgId: 2, destOrgId: 4, paymentMethodId });
      const r3 = await PayRouterRoute.create({ network: net, sourceOrgId: 4, destOrgId: 3, paymentMethodId });
      const r4 = await PayRouterRoute.create({ network: net, sourceOrgId: 5, destOrgId: 3, paymentMethodId });
      const r5 = await PayRouterRoute.create({ network: net, sourceOrgId: 6, destOrgId: 5, paymentMethodId });
      const r6 = await PayRouterRoute.create({ network: net, sourceOrgId: 4, destOrgId: 1, paymentMethodId });
      const r7 = await PayRouterRoute.create({ network: net, sourceOrgId: 3, destOrgId: 1, paymentMethodId });
      const r8 = await PayRouterRoute.create({ network: net, sourceOrgId: 4, destOrgId: 1, paymentMethodId });
      const r9 = await PayRouterRoute.create({ network: net, sourceOrgId: 1, destOrgId: 3, paymentMethodId });
      const r10 = await PayRouterRoute.create({ network: net, sourceOrgId: 2, destOrgId: 1, paymentMethodId });
      const r11 = await PayRouterRoute.create({ network: net, sourceOrgId: 6, destOrgId: 2, paymentMethodId });
      const r12 = await PayRouterRoute.create({ network: net, sourceOrgId: 6, destOrgId: 3, paymentMethodId });

      await request(app.getHttpServer())
        .get(`/v1/routes/NG/3`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(9);

          // Check the first route (4 -> 3)
          expect(res.body.data[0].length).toBe(1);
          expect(res.body.data[0][0].id).toBe(r3.id);
          expect(res.body.data[0][0].sourceOrgId).toBe(4);
          expect(res.body.data[0][0].destOrgId).toBe(3);
          expect(res.body.data[0][0].bond).toBe('0');

          // Check the second route (6 -> 3)
          expect(res.body.data[1].length).toBe(1);
          expect(res.body.data[1][0].id).toBe(r12.id);
          expect(res.body.data[1][0].sourceOrgId).toBe(6);
          expect(res.body.data[1][0].destOrgId).toBe(3);
          expect(res.body.data[1][0].bond).toBe('0');

          // Check the third route (4 -> 1 -> 3)
          expect(res.body.data[2].length).toBe(2);
          expect(res.body.data[2][0].id).toBe(r6.id);
          expect(res.body.data[2][0].sourceOrgId).toBe(4);
          expect(res.body.data[2][0].destOrgId).toBe(1);
          expect(res.body.data[2][0].bond).toBe('0');
          expect(res.body.data[2][1].id).toBe(r1.id);
          expect(res.body.data[2][1].sourceOrgId).toBe(1);
          expect(res.body.data[2][1].destOrgId).toBe(3);
          expect(res.body.data[2][1].bond).toBe('0');

          // Check the fourth route (4 -> 1 -> 3)
          expect(res.body.data[3].length).toBe(2);
          expect(res.body.data[3][0].id).toBe(r8.id);
          expect(res.body.data[3][0].sourceOrgId).toBe(4);
          expect(res.body.data[3][0].destOrgId).toBe(1);
          expect(res.body.data[3][0].bond).toBe('0');
          expect(res.body.data[3][1].id).toBe(r1.id);
          expect(res.body.data[3][1].sourceOrgId).toBe(1);
          expect(res.body.data[3][1].destOrgId).toBe(3);
          expect(res.body.data[3][1].bond).toBe('0');

          // Check the fifth route (6 -> 5 -> 3)
          expect(res.body.data[4].length).toBe(2);
          expect(res.body.data[4][0].id).toBe(r5.id);
          expect(res.body.data[4][0].sourceOrgId).toBe(6);
          expect(res.body.data[4][0].destOrgId).toBe(5);
          expect(res.body.data[4][0].bond).toBe('0');
          expect(res.body.data[4][1].id).toBe(r4.id);
          expect(res.body.data[4][1].sourceOrgId).toBe(5);
          expect(res.body.data[4][1].destOrgId).toBe(3);
          expect(res.body.data[4][1].bond).toBe('0');

          // Check the sixth route (4 -> 1 -> 3)
          expect(res.body.data[5].length).toBe(2);
          expect(res.body.data[5][0].id).toBe(r6.id);
          expect(res.body.data[5][0].sourceOrgId).toBe(4);
          expect(res.body.data[5][0].destOrgId).toBe(1);
          expect(res.body.data[5][0].bond).toBe('0');
          expect(res.body.data[5][1].id).toBe(r9.id);
          expect(res.body.data[5][1].sourceOrgId).toBe(1);
          expect(res.body.data[5][1].destOrgId).toBe(3);
          expect(res.body.data[5][1].bond).toBe('0');

          // Check the seventh route (4 -> 1 -> 3)
          expect(res.body.data[6].length).toBe(2);
          expect(res.body.data[6][0].id).toBe(r8.id);
          expect(res.body.data[6][0].sourceOrgId).toBe(4);
          expect(res.body.data[6][0].destOrgId).toBe(1);
          expect(res.body.data[6][0].bond).toBe('0');
          expect(res.body.data[6][1].id).toBe(r9.id);
          expect(res.body.data[6][1].sourceOrgId).toBe(1);
          expect(res.body.data[6][1].destOrgId).toBe(3);
          expect(res.body.data[6][1].bond).toBe('0');

          // Check the eighth route (6 -> 2 -> 1 -> 3)
          expect(res.body.data[7].length).toBe(3);
          expect(res.body.data[7][0].id).toBe(r11.id);
          expect(res.body.data[7][0].sourceOrgId).toBe(6);
          expect(res.body.data[7][0].destOrgId).toBe(2);
          expect(res.body.data[7][0].bond).toBe('0');
          expect(res.body.data[7][1].id).toBe(r10.id);
          expect(res.body.data[7][1].sourceOrgId).toBe(2);
          expect(res.body.data[7][1].destOrgId).toBe(1);
          expect(res.body.data[7][1].bond).toBe('0');
          expect(res.body.data[7][2].id).toBe(r1.id);
          expect(res.body.data[7][2].sourceOrgId).toBe(1);
          expect(res.body.data[7][2].destOrgId).toBe(3);
          expect(res.body.data[7][2].bond).toBe('0');

          // Check the ninth route (6 -> 2 -> 1 -> 3)
          expect(res.body.data[8].length).toBe(3);
          expect(res.body.data[8][0].id).toBe(r11.id);
          expect(res.body.data[8][0].sourceOrgId).toBe(6);
          expect(res.body.data[8][0].destOrgId).toBe(2);
          expect(res.body.data[8][0].bond).toBe('0');
          expect(res.body.data[8][1].id).toBe(r10.id);
          expect(res.body.data[8][1].sourceOrgId).toBe(2);
          expect(res.body.data[8][1].destOrgId).toBe(1);
          expect(res.body.data[8][1].bond).toBe('0');
          expect(res.body.data[8][2].id).toBe(r9.id);
          expect(res.body.data[8][2].sourceOrgId).toBe(1);
          expect(res.body.data[8][2].destOrgId).toBe(3);
          expect(res.body.data[8][2].bond).toBe('0');
        });
    });

    describe('route with no payment method', () => {
      it('should ignore routes with no payment method', async () => {
        const r1 = await PayRouterRoute.create({
          network: net,
          sourceOrgId: 4,
          destOrgId: 3,
          bond: '6',
          paymentMethodId: 'pm_1',
        });
        await PayRouterRoute.create({
          network: net,
          sourceOrgId: 4,
          destOrgId: 3,
          bond: '5',
        });
        await request(app.getHttpServer())
          .get(`/v1/routes/NG/3`)
          .query({ net, minBond: '5' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0][0].id).toBe(r1.id);
          });
      });
    });

    describe('include minBond filter', () => {
      it('should ignore routes with bond less than minBond', async () => {
        const r1 = await PayRouterRoute.create({
          network: net,
          sourceOrgId: 4,
          destOrgId: 3,
          bond: '4',
          paymentMethodId: 'pm_1',
        });
        const r2 = await PayRouterRoute.create({
          network: net,
          sourceOrgId: 4,
          destOrgId: 3,
          bond: '5',
          paymentMethodId: 'pm_2',
        });
        await request(app.getHttpServer())
          .get(`/v1/routes/NG/3`)
          .query({ net, minBond: '5' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0][0].id).toBe(r2.id);
          });

        await PayRouterRoute.updateById(r1.id, { bond: '6' });
        await request(app.getHttpServer())
          .get(`/v1/routes/NG/3`)
          .query({ net, minBond: '5' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.length).toBe(2);
            expect(res.body.data[0][0].id).toBe(r2.id);
            expect(res.body.data[1][0].id).toBe(r1.id);
          });
      });
    });

    describe('include maxDepth filter', () => {
      it('should ignore routes with depth greater than maxDepth', async () => {
        const r1 = await PayRouterRoute.create({ network: net, sourceOrgId: 4, destOrgId: 3, paymentMethodId: 'pm_1' });
        await PayRouterRoute.create({ network: net, sourceOrgId: 1, destOrgId: 3, paymentMethodId: 'pm_2' });
        await PayRouterRoute.create({ network: net, sourceOrgId: 4, destOrgId: 1, paymentMethodId: 'pm_3' });
        await request(app.getHttpServer())
          .get(`/v1/routes/NG/3`)
          .query({ net, maxDepth: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].length).toBe(1);
            expect(res.body.data[0][0].id).toBe(r1.id);
          });
      });
    });
  });

  describe('.updatePaymentMethod', () => {
    it('should return 400 when not authorized', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/payment-method')
        .send({ paymentMethodId: 1 })
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when payment method ID was not provided', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/payment-method')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'payment method ID is required',
            param: 'paymentMethodId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when route does not exist or does not belong to the user', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/payment-method')
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: 'pm_123' })
        .expect(404)
        .expect({
          error: { message: 'Route not found' },
        });

      const route = await PayRouterRoute.create({ owner: '0xSomeone' });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/payment-method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: 'pm_123' })
        .expect(404)
        .expect({
          error: { message: 'Route not found' },
        });
    });

    it('should return 404 when payment method does not exist or does not belong to the user', async () => {
      const route = await PayRouterRoute.create({ owner: u.address });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/payment-method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: 'pm_123' })
        .expect(404)
        .expect({
          error: { message: 'Payment method not found' },
        });

      const pm = await PaymentMethod.create({ userId: 'user_123' });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/payment-method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: pm.id })
        .expect(404)
        .expect({
          error: { message: 'Payment method not found' },
        });
    });

    it('should return 400 when payment method org does not match route source org', async () => {
      const org = await PayRouterOrg.create({ network: net, name: 'Chase Bank', orgId: 1 });
      const route = await PayRouterRoute.create({ owner: u.address });
      const pm = await PaymentMethod.create({ userId: u.id, orgId: org.id });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/payment-method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: pm.id })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Payment method org must match route source org',
          },
        });
    });

    it('should successfully update the payment method for a route', async () => {
      const org = await PayRouterOrg.create({ network: net, name: 'Chase Bank', orgId: 1 });
      let route = await PayRouterRoute.create({ owner: u.address, sourceOrgId: org.orgId });
      const pm = await PaymentMethod.create({ userId: u.id, orgId: org.id });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/payment-method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: pm.id })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.paymentMethodId).toBe(pm.id);
        });

      route = await PayRouterRoute.getById(route.id);
      expect(route.paymentMethodId).toBe(pm.id);
    });
  });

  describe('.updateFee', () => {
    it('should return 400 when not authorized', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/fee')
        .send({ fee: 1 })
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when fee was not provided', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/fee')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'fee is required',
            param: 'fee',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when fee is greater than 5', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/fee')
        .set('Authorization', `Bearer ${token}`)
        .send({ fee: 6 })
        .expect(400)
        .expect({
          error: {
            message: 'fee cannot be greater than 5',
            param: 'fee',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when route does not exist or does not belong to the user', async () => {
      await request(app.getHttpServer())
        .put('/v1/routes/pr_route_123/fee')
        .set('Authorization', `Bearer ${token}`)
        .send({ fee: 1 })
        .expect(404)
        .expect({
          error: { message: 'Route not found' },
        });

      const route = await PayRouterRoute.create({ owner: '0xSomeone' });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/fee`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fee: 1 })
        .expect(404)
        .expect({
          error: { message: 'Route not found' },
        });
    });

    it('should return 200 when fee is successfully updated', async () => {
      let route = await PayRouterRoute.create({ owner: u.address });
      await request(app.getHttpServer())
        .put(`/v1/routes/${route.id}/fee`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fee: 2 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(route.id);
          expect(res.body.data.fee).toBe(2);
        });

      route = await PayRouterRoute.getById(route.id);
      expect(route.fee).toBe(2);
    });
  });
});

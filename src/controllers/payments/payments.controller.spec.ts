import { ChainNames } from '@jointlabs/meta';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import NetworkService from '../../network/network.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net: ChainNames = 'ethereum';

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

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [PaymentsController],
      providers: [PaymentsService, NetworkService],
    })
      .overrideProvider(NetworkService)
      .useValue(new (jest.fn())())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  describe('.getPaymentMethods', function () {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods`)
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods`)
        .query({ net: 'net1' })
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and non-empty result when network is correct', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods`)
        .query({ net: 'ethereum' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body.data[0]).toHaveProperty('badge');
          expect(res.body.data[0]).toHaveProperty('name');
          expect(res.body.data[0]).toHaveProperty('logoUrl');
        });
    });
  });

  describe('.getGrantSignature', function () {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({ net: 'net1' })
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when badge was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({ net })
        .expect({
          error: {
            message: 'badge is required',
            param: 'badge',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when provider address was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({ net, badge: 'badge' })
        .expect({
          error: {
            message: 'provider address is required',
            param: 'address',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when provider address is invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({ net, badge: 'badge', address: '0xProvider' })
        .expect({
          error: {
            message: 'provider address is invalid',
            param: 'address',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when liquidity address was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({ net, badge: 'badge', address: '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15' })
        .expect({
          error: {
            message: 'liquidity address is required',
            param: 'liquidityAddress',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when liquidity address was invalid', async () => {
      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(400)
        .query({
          net,
          badge: 'badge',
          address: '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15',
          liquidityAddress: '0xAddress',
        })
        .expect({
          error: {
            message: 'liquidity address is invalid',
            param: 'liquidityAddress',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when `disable` value was invalid', async () => {
      jest.spyOn(app.get(PaymentsService), 'getPaymentMethodGrantSignature').mockResolvedValue({ isNew: true });

      await request(app.getHttpServer())
        .get(`/v1/payments/methods/grant-signature`)
        .expect(200)
        .query({
          net,
          badge: 'badge',
          address: '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15',
          liquidityAddress: '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15',
          disable: 'invalid',
        })
        .expect({ data: { isNew: true } });
    });
  });
});

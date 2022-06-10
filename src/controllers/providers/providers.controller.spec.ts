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
import { ProvidersController } from './providers.controller';
import MarketProvider from '../../models/market_provider';
import * as moment from 'moment';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();

describe('ProviderController', () => {
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
    mockGetMarketCore.mockReset();

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [ProvidersController],
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
  const net = 'ethereumMainnet';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.list', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/providers`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/providers`)
        .query({ net: 'net1' })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'unknown network' },
        });
    });

    describe('with correct network', () => {
      it('should return 200 and correct result', async () => {
        const prov = await MarketProvider.create({ network: net });
        await request(app.getHttpServer())
          .get(`/v1/providers`)
          .query({ net })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with correct network and market ID', () => {
      it('should return 200 and correct result', async () => {
        await MarketProvider.create({ network: net });
        const prov = await MarketProvider.create({
          network: net,
          marketId: '0x123',
        });
        await request(app.getHttpServer())
          .get(`/v1/providers`)
          .query({ net, mid: prov.marketId })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with limit specified', () => {
      it('should return 200 and correct result', async () => {
        await MarketProvider.create({
          network: net,
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        const prov = await MarketProvider.create({
          network: net,
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/providers`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with offset specified', () => {
      it('should return 200 and correct result', async () => {
        const prov = await MarketProvider.create({
          sn: 1,
          network: net,
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        await MarketProvider.create({
          sn: 2,
          network: net,
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/providers`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(prov.id);
          });
      });
    });

    describe('with count specified', () => {
      it('should return 200 and correct count', async () => {
        await MarketProvider.create({
          sn: 1,
          network: net,
          createdAt: moment().subtract(1, 's').toISOString(),
        });
        await MarketProvider.create({
          sn: 2,
          network: net,
          createdAt: moment().toISOString(),
        });
        await request(app.getHttpServer())
          .get(`/v1/providers`)
          .query({ net, count: true })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data.count).toEqual('2');
          });
      });
    });
  });
});

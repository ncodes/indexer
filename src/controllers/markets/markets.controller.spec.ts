import { Test, TestingModule } from '@nestjs/testing';
import { MarketsController } from './markets.controller';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import NetworkService from '../../network/network.service';
import { MarketsService } from './markets.service';
import { MetadataService } from '../../services/metadata.service';
import { makeSession } from '../auth/utils';
import * as cryptoRandomString from 'crypto-random-string';
import Market from '../../models/market';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('MarketsController', () => {
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
      controllers: [MarketsController],
      providers: [
        ConfigService,
        NetworkService,
        MarketsService,
        MetadataService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
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

  describe('.get', () => {
    it('should 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/net1/0x123`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/net1/0x123`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    it('should 404 when market is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/${net}/0x123`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should 200 and market object when market exists', async () => {
      const market = await Market.create({ mid: '0x123', network: net });

      const mockExtendMarket = jest
        .spyOn(app.get(MarketsService), 'extendMarket')
        .mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/v1/markets/${net}/${market.mid}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(market.id);
          expect(res.body.data.mid).toEqual(market.mid);
          expect(mockExtendMarket).toHaveBeenCalled();
        });
    });
  });

  describe('.list', () => {
    it('should 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/net1`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/net1`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    it('should 200 and empty list when no market was found ', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/${net}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(0);
        });
    });

    it('should 200 and list of markets when some markets exist', async () => {
      const market = await Market.create({ mid: '0x123' });

      jest
        .spyOn(app.get(MarketsService), 'extendMarket')
        .mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/v1/markets/${net}`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(market.id);
        });
    });

    describe('filter by creator', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          mid: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ creator: '0xCreator' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (creator address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          mid: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.creator })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (market ID)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          mid: '0x123',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.mid })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (base asset)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          base: 'BTC',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.base })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (base asset address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          baseAddress: '0xBaseAddress',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.baseAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (quote asset)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          quote: 'BTC',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.quote })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (quote asset address)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          quoteAddress: '0xQuoteAddress',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: market.quoteAddress })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('filter by query (pair symbol)', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          pair: 'BTCUSDT',
        });
        await Market.create({});

        jest
          .spyOn(app.get(MarketsService), 'extendMarket')
          .mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: 'BTCUSDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: 'BTC/USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: 'BTC USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets/${net}`)
          .query({ query: 'BTC-USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });
  });
});

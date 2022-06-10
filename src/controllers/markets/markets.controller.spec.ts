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
import InvitedMediator from '../../models/invited_mediators';
import PermittedTrader from '../../models/permitted_trader';

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
      providers: [ConfigService, NetworkService, MarketsService, MetadataService],
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
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123`)
        .set('Authorization', 'bearer ' + token)
        .query({ net: 'net1' })
        .send({})
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    it('should return 404 when market is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .send({})
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should 200 and market object when market exists', async () => {
      const market = await Market.create({ marketId: '0x123', network: net });

      const mockExtendMarket = jest
        .spyOn(app.get(MarketsService), 'extendMarket')
        .mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/v1/markets/${market.marketId}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(market.id);
          expect(res.body.data.marketId).toEqual(market.marketId);
          expect(mockExtendMarket).toHaveBeenCalled();
        });
    });
  });

  describe('.list', () => {
    it('should 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .send({})
        .query({ net })
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
        .get(`/v1/markets`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .query({ net: 'net1' })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    it('should 200 and empty list when no market was found ', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .set('Authorization', 'bearer ' + token)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(0);
        });
    });

    it('should 200 and list of markets when some markets exist', async () => {
      const market = await Market.create({ network: net, marketId: '0x123' });
      jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/v1/markets`)
        .query({ net })
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
          network: net,
          marketId: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ creator: '0xCreator', net })
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
          network: net,
          marketId: '0x123',
          creator: '0xCreator',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ query: market.creator, net })
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
          network: net,
          marketId: '0x123',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ query: market.marketId, net })
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
          network: net,
          base: 'BTC',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.base })
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
          network: net,
          baseAddress: '0xBaseAddress',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.baseAddress })
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
          network: net,
          quote: 'BTC',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.quote })
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
          network: net,
          quoteAddress: '0xQuoteAddress',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: market.quoteAddress })
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
          network: net,
          pair: 'BTCUSDT',
        });
        await Market.create({});

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTCUSDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC/USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, query: 'BTC-USDT' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('limit=1', () => {
      it('should 200 and correct market', async () => {
        await Market.create({
          network: net,
          quoteAddress: '0xQuoteAddress',
        });
        const market = await Market.create({ network: net });

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });

    describe('offset is set', () => {
      it('should 200 and correct market', async () => {
        const market = await Market.create({
          network: net,
          quoteAddress: '0xQuoteAddress',
        });
        await Market.create({ network: net });

        jest.spyOn(app.get(MarketsService), 'extendMarket').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/markets`)
          .query({ net, limit: 1, offset: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(market.id);
          });
      });
    });
  });

  describe('.listInvitedMediators', () => {
    it('should 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123/invited_mediators`)
        .send({})
        .query({ net })
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
        .get(`/v1/markets/0x123/invited_mediators`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .query({ net: 'net1' })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    describe('with no filter', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await InvitedMediator.create({ network: net, marketId: mid });
        const iv = await InvitedMediator.create({
          network: net,
          marketId: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/invited_mediators`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with limit=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await InvitedMediator.create({ network: net, marketId: mid });
        const iv = await InvitedMediator.create({
          network: net,
          marketId: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/invited_mediators`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, limit: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with accepted=true', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await InvitedMediator.create({ network: net, marketId: mid });
        const iv = await InvitedMediator.create({
          network: net,
          marketId: mid,
          accepted: true,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/invited_mediators`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, accepted: 'true' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with accepted=false', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await InvitedMediator.create({
          network: net,
          marketId: mid,
          accepted: true,
        });
        const iv = await InvitedMediator.create({
          network: net,
          marketId: mid,
          accepted: false,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/invited_mediators`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, accepted: 'false' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with offset=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        const iv = await InvitedMediator.create({
          network: net,
          marketId: mid,
        });
        await InvitedMediator.create({ network: net, marketId: mid });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/invited_mediators`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, limit: 1, offset: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });
  });

  describe('.listPermittedTraders', () => {
    it('should 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/markets/0x123/permitted_traders`)
        .send({})
        .query({ net })
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
        .get(`/v1/markets/0x123/permitted_traders`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .query({ net: 'net1' })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'unknown network' },
        });
    });

    describe('with no filter', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await PermittedTrader.create({ network: net, marketId: mid });
        const iv = await PermittedTrader.create({
          network: net,
          marketId: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_traders`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with limit=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        await PermittedTrader.create({ network: net, marketId: mid });
        const iv = await PermittedTrader.create({
          network: net,
          marketId: mid,
        });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_traders`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, limit: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });

    describe('with offset=1', () => {
      it('should correct results', async () => {
        const mid = '0x123';
        const iv = await PermittedTrader.create({
          network: net,
          marketId: mid,
        });
        await PermittedTrader.create({ network: net, marketId: mid });
        await request(app.getHttpServer())
          .get(`/v1/markets/${mid}/permitted_traders`)
          .set('Authorization', 'bearer ' + token)
          .send({})
          .query({ net, limit: 1, offset: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(iv.id);
          });
      });
    });
  });
});

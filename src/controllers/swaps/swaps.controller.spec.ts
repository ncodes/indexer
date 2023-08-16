import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import NetworkService from '../../network/network.service';
import { makeSession } from '../auth/utils';
import { MarketService } from '../markets/market.service';
import { SwapsController } from './swaps.controller';
import { LiquidityService } from '../liquidity/liquidity.service';
import Swap from '../../models/swap';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import SwapService from './swap.service';
import { randStr } from '../../common/common';
import { MetadataService } from '../../services/metadata/metadata.service';
import Dispute from '../../models/dispute';
import Event from '../../models/event';
import * as moment from 'moment';
import { RedisService } from '../../services/redis.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

describe('SwapsController', () => {
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
      controllers: [SwapsController],
      providers: [
        ConfigService,
        MetadataService,
        NetworkService,
        MarketService,
        LiquidityService,
        SwapService,
        RedisService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  let token: string;
  const net = 'ethereum';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.get', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0`)
        .query({ net: 'net1' })
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

    it('should return 404 when swap order was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'swap not found' },
        });
    });

    it('should return 404 when swap order was not found', async () => {
      await Swap.create({ network: net, orderId: 1, marketAddress: '0xMarket' });
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'market not found' },
        });
    });

    it('should return 404 when liquidity was not found', async () => {
      const market = await Market.create({
        network: net,
        address: '0xMarket',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketAddress: market.address,
      });
      jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'liquidity not found' },
        });
    });

    it('should return 404 when liquidity was not found', async () => {
      const market = await Market.create({
        network: net,
        address: '0xMarket',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketAddress: market.address,
      });
      jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: { message: 'liquidity not found' },
        });
    });

    it('should return 200 with correct result', async () => {
      const market = await Market.create({
        network: net,
        address: '0xMarket',
      });
      await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider: '0xProvider',
      });
      await Swap.create({
        network: net,
        orderId: 1,
        marketAddress: market.address,
        provider: '0xProvider',
      });
      jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
      jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/v1/swaps/1`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.liquidity).toBeDefined();
          expect(res.body.data.market).toBeDefined();
        });
    });
  });

  describe('.list', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps`)
        .query({ net: 'net1' })
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

    describe('with address set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          address: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider2',
        });
        const swap = await Swap.create({
          network: net,
          orderId: 1,
          marketAddress: market.address,
          provider: '0xProvider',
        });

        const swap2 = await Swap.create({
          network: net,
          orderId: 1,
          marketAddress: market.address,
          taker: '0xProvider',
          provider: '0xProvider2',
        });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.address, address: '0xProvider' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(swap2.id);
            expect(res.body.data[1].id).toEqual(swap.id);
          });

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.address, address: '0xProvider2' })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap2.id);
          });
      });
    });

    describe('with limit set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          address: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider2',
        });
        await Swap.create({
          network: net,
          orderId: 1,
          marketAddress: market.address,
          provider: '0xProvider',
        });
        const swap2 = await Swap.create({
          network: net,
          orderId: 2,
          marketAddress: market.address,
          provider: '0xProvider',
        });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({ net, mid: market.address, address: '0xProvider', limit: 1 })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap2.id);
            expect(res.body.meta.queryCount).toEqual('2');
          });
      });
    });

    describe('with limit and offset set', () => {
      it('should return 200 and correct result', async () => {
        const market = await Market.create({
          network: net,
          address: '0xMarket',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider',
        });
        await Liquidity.create({
          network: net,
          marketAddress: market.address,
          provider: '0xProvider2',
        });
        const swap = await Swap.create({
          network: net,
          orderId: 1,
          marketAddress: market.address,
          provider: '0xProvider',
        });
        await Swap.create({
          network: net,
          orderId: 2,
          marketAddress: market.address,
          provider: '0xProvider',
        });

        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();
        jest.spyOn(app.get(LiquidityService), 'extendLiquidity').mockResolvedValue(null);

        await request(app.getHttpServer())
          .get(`/v1/swaps`)
          .query({
            net,
            mid: market.address,
            address: '0xProvider',
            offset: 1,
            limit: 1,
          })
          .set('Authorization', 'bearer ' + token)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(swap.id);
            expect(res.body.meta.queryCount).toEqual('2');
          });
      });
    });
  });

  describe('.events', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/events`)
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

    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/events`)
        .query({ net: 'net1' })
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

    it('should return 200 and return correct value', async () => {
      const swap = await Swap.create({ network: net, orderId: 1 });
      const dispute = await Dispute.create({ network: net, marketAddress: '0xMarket', orderId: 1, disputeId: 1 });
      const event = await Event.create({
        network: net,
        orderId: 1,
        marketAddress: '0xMarket',
        disputeId: 1,
        createdAt: moment().subtract(1, 's').toISOString(),
      });
      const event2 = await Event.create({
        network: net,
        orderId: 1,
        marketAddress: '0xMarket',
        disputeId: 1,
        createdAt: moment().subtract(1, 's').toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/events`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(event2.id);
          expect(res.body.data[1].id).toEqual(event.id);
          expect(res.body.data[0].swap).toBeDefined();
          expect(res.body.data[0].dispute).toBeDefined();
          expect(res.body.data[0].swap.id).toEqual(swap.id);
          expect(res.body.data[0].dispute.id).toEqual(dispute.id);
          expect(res.body.data[1].swap).toBeDefined();
          expect(res.body.data[1].dispute).toBeDefined();
          expect(res.body.data[1].swap.id).toEqual(swap.id);
          expect(res.body.data[1].dispute.id).toEqual(dispute.id);
        });
    });
  });

  describe('.listParticipants', () => {
    it('should return 400 when network is provided but unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/participants`)
        .query({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when network is provided but unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/participants`)
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

    it('should return 404 when swap order was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/swaps/0/participants`)
        .query({ net })
        .expect(404)
        .expect({
          error: {
            param: 'id',
            type: 'invalid_request_error',
            message: 'swap not found',
          },
        });
    });

    it('should return list of participants', async () => {
      await Swap.create({ network: net, orderId: 1 });
      const getParticipants = jest.spyOn(app.get(SwapService), 'getParticipants').mockResolvedValue(null);
      getParticipants.mockResolvedValue(['0xParticipant1', '0xParticipant2']);
      await request(app.getHttpServer())
        .get(`/v1/swaps/1/participants`)
        .query({ net })
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect({
          data: ['0xParticipant1', '0xParticipant2'],
        });
    });
  });
});

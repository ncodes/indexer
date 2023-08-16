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
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import Ticket from '../../models/ticket';
import Market from '../../models/market';
import * as moment from 'moment';
import { randStr } from '../../common/common';
import { MetadataService } from '../../services/metadata/metadata.service';
import { toBN } from '../../network/common';
import { RedisService } from '../../services/redis.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetTicketPrice = jest.fn();
const mockTicketSupply = jest.fn();
const mockTicketSold = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {
    getContracts: jest.fn().mockImplementation(() => {
      return {
        mediatorMgr: {
          getTicketPrice: mockGetTicketPrice,
          ticketSupply: mockTicketSupply,
          ticketSold: mockTicketSold,
        },
      };
    }),
  };
});

const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

describe('TicketsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};
  const marketAddress = '0xMarket';
  const owner = '0xOwner';

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
    cfgObj[`app.networks.${net}.p2pTokenAddr`] = '0xP2PToken';

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [TicketsController],
      providers: [ConfigService, NetworkService, MarketService, MetadataService, TicketsService, RedisService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
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
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tickets/0xOwner/0`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when ticket was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tickets/${owner}/0`)
        .query({ net })
        .expect(404)
        .expect({
          error: { message: 'ticket not found' },
        });
    });

    it('should return 200 when ticket exist', async () => {
      const ticket = await Ticket.create({
        network: net,
        owner: '0xOwner',
        index: 0,
      });
      const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');
      await request(app.getHttpServer())
        .get(`/v1/tickets/${ticket.owner}/${ticket.index}`)
        .query({ net })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toEqual(ticket.id);
          expect(mockTicket).toBeCalled();
        });
    });
  });

  describe('.list', () => {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tickets`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    describe('query: count=true', () => {
      it('should return correct count', async () => {
        await Ticket.create({
          network: net,
          owner,
          index: 0,
        });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, count: true })
          .send({})
          .expect(200)
          .expect({ data: { count: '1' } });
      });
    });

    describe('query: poolId=2', () => {
      it('should return correct ticket list', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        await Ticket.create({ network: net, owner, poolId: 1 });
        const ticket = await Ticket.create({ network: net, poolId: 2 });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, poolId: 2 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: owner', () => {
      it('should return correct ticket list', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, owner });
        await Ticket.create({ network: net });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, owner })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: orderId=1', () => {
      it('should return correct ticket list', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, orderId: 1 });
        await Ticket.create({ network: net, orderId: 2 });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, orderId: 1 })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: disputeId=1', () => {
      it('should return correct ticket list', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, disputeId: 1 });
        await Ticket.create({ network: net, disputeId: 2 });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, disputeId: 1 })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: joined is set', () => {
      it('should return correct ticket list when joined=true', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        await Market.create({ network: net, address: marketAddress });
        const ticket = await Ticket.create({ network: net, joined: true });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, joined: 'true' })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });

      it('should return correct ticket list when joined=false', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');
        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();

        await Ticket.create({ network: net, joined: true });
        const ticket = await Ticket.create({ network: net, joined: false });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, joined: false })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: matured is set', () => {
      it('should return correct ticket list when matured=true', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const now = moment();
        await Ticket.create({ network: net });
        const ticket = await Ticket.create({
          network: net,
          matureAt: now.subtract(1, 'h').toISOString(),
        });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, matured: true })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });

      it('should return correct ticket list when matured=false', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const now = moment();
        const ticket = await Ticket.create({
          network: net,
          matureAt: now.add(1, 'h').toISOString(),
        });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, matured: false })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: drafted is set', () => {
      it('should return correct ticket list when drafted=true', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, drafted: true });
        await Ticket.create({ network: net });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, drafted: 'true' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });

      it('should return correct ticket list when drafted=false', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        await Ticket.create({ network: net, drafted: false });
        await Ticket.create({ network: net });
        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, drafted: 'false' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: expired is set', () => {
      it('should return correct ticket list when ticket has no market and' + ' past join time', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');
        jest.spyOn(app.get(MarketService), 'extendMarket').mockResolvedValue();

        await Market.create({ network: net, address: '0xMarket' });
        const now = moment();
        const ticket = await Ticket.create({
          network: net,
          joinBy: now.subtract(1, 'h').toISOString(),
        });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, expired: 'true' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });

      it('should return correct ticket list when ticket has been drained', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, drained: true });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, expired: 'true' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: cancelled is set', () => {
      it('should return correct ticket when cancelled=true', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const now = moment();
        const ticket = await Ticket.create({
          network: net,
          cancelAt: now.subtract(1, 'h').toISOString(),
        });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, cancelled: 'true' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(res.body.data[0].cancelled).toBeTruthy();
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: slashed is set', () => {
      it('should return correct ticket when slashed=true', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, slashed: true });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, slashed: 'true' })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: limit is set', () => {
      it('should return correct ticket', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        await Ticket.create({ network: net, slashed: true });
        const ticket = await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, limit: 1 })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });

    describe('query: offset is set', () => {
      it('should return correct ticket', async () => {
        const mockTicket = jest.spyOn(app.get(TicketsService), 'extendTicket');

        const ticket = await Ticket.create({ network: net, slashed: true });
        await Ticket.create({ network: net });

        await request(app.getHttpServer())
          .get(`/v1/tickets`)
          .query({ net, limit: 1, offset: 1 })
          .send({})
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(ticket.id);
            expect(mockTicket).toBeCalled();
          });
      });
    });
  });

  describe('.stats', () => {
    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/tickets/stats`)
        .send({})
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
        .get(`/v1/tickets/stats`)
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

    it('should return correct values', async () => {
      await Ticket.create({ network: net, bond: '10', owner: '0xOwner' });
      await Ticket.create({ network: net, bond: '15', owner: '0xOwner2' });

      mockGetTicketPrice.mockResolvedValue(toBN(100));
      mockTicketSupply.mockResolvedValue(toBN(1000));
      mockTicketSold.mockResolvedValue(toBN(25));
      mockTryToUsd.mockResolvedValue(123);

      await request(app.getHttpServer())
        .get(`/v1/tickets/stats`)
        .query({ net })
        .expect(200)
        .expect({
          data: {
            totalBonds: '25',
            totalBondsUsd: 123,
            price: '100',
            priceUsd: 123,
            ticketSupply: 1000,
            ticketAvailable: 975,
          },
        });
    });

    it('should return correct values if "owner" is set', async () => {
      await Ticket.create({ network: net, bond: '10', owner: '0xOwner' });
      await Ticket.create({ network: net, bond: '15', owner: '0xOwner2' });

      mockGetTicketPrice.mockResolvedValue(toBN(100));
      mockTicketSupply.mockResolvedValue(toBN(1000));
      mockTicketSold.mockResolvedValue(toBN(25));
      mockTryToUsd.mockResolvedValue(123);

      await request(app.getHttpServer())
        .get(`/v1/tickets/stats`)
        .query({ net, owner: '0xOwner' })
        .expect(200)
        .expect({
          data: {
            totalBonds: '25',
            totalBondsUsd: 123,
            price: '100',
            priceUsd: 123,
            ticketSupply: 1000,
            ticketAvailable: 975,
            owner: {
              totalBonds: '10',
              totalBondsUsd: 123,
              total: '1',
            },
          },
        });
    });
  });
});

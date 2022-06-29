import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { TicketsService } from './tickets.service';
import { MarketsService } from '../markets/markets.service';
import Ticket from '../../models/ticket';
import Market from '../../models/market';
import * as moment from 'moment';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetMarketCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getMarketCore: mockGetMarketCore };
});

const mockGetLogo = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    getLogo: mockGetLogo,
  };
});

describe('TicketsService', () => {
  let module: TestingModule;
  let service: TicketsService;
  const net = 'net';
  const db = DBService.getForTest();
  let cfgObj = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCfgGet.mockReset();
    mockGetMarketCore.mockReset();
    mockGetLogo.mockReset();

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [ConfigService, TicketsService, MarketsService, NetworkService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('.extendTicket', () => {
    describe('when ticket.marketId is set', () => {
      it('should return error when market was not found', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          marketId: '0xMarket',
        });

        await expect(service.extendTicket(ticket, false, undefined, false)).rejects.toEqual(
          new Error('market not found'),
        );
      });

      it('should append market to ticket if when market exist', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          marketId: market.marketId,
        });

        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();

        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();

        expect(ticket.market).toBeDefined();
        expect(ticket.market.id).toEqual(market.id);
      });
    });

    describe('when ticket.marketId is set bot `noMarket` is true', () => {
      it('should append market to ticket if when market exist', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          marketId: market.marketId,
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(service.extendTicket(ticket, false, undefined, true)).resolves.toBeUndefined();
        expect(ticket.market).toBeUndefined();
      });
    });

    describe('when `matureAt` is set to a past date', () => {
      it('should set `matured` = true', async () => {
        const market = await Market.create({
          network: net,
          marketId: '0xMarket',
        });
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          marketId: market.marketId,
          matureAt: moment().subtract('1', 'hour').toISOString(),
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.matured).toBeTruthy();
      });
    });

    describe('when `joinBy` is set to a past date and `marketId` is set', () => {
      it('should set `expired` = true', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          joinBy: moment().subtract('1', 'hour').toISOString(),
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.expired).toBeTruthy();
      });
    });

    describe('when `drained` is true', () => {
      it('should set `expired` = true', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          drained: true,
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.expired).toBeTruthy();
      });
    });

    describe('when `cancelAt` is set to a past date', () => {
      it('should set `cancelled` = true', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          cancelAt: moment().subtract('1', 'hour').toISOString(),
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.cancelled).toBeTruthy();
      });
    });

    describe('when `cancelAt` is set to a future date', () => {
      it('should set `cancelling` = true', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          cancelAt: moment().add('1', 'hour').toISOString(),
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.cancelling).toBeTruthy();
      });
    });

    describe('when `leaveAt` is set to a past date', () => {
      it('should set `canLeave` = true', async () => {
        const ticket = await Ticket.create({
          network: net,
          owner: '0xOwner',
          index: 0,
          leaveAt: moment().subtract('1', 'hour').toISOString(),
        });
        jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();
        await expect(
          service.extendTicket(ticket, false, undefined, false),
        ).resolves.toBeUndefined();
        expect(ticket.canLeave).toBeTruthy();
      });
    });
  });
});

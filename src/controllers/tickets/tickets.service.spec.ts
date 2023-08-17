import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { TicketsService } from './tickets.service';
import { MarketService } from '../markets/market.service';
import Ticket from '../../models/ticket';
import * as moment from 'moment';
import { RedisService } from '../../services/redis.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
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
    mockGetLogo.mockReset();

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [
        ConfigService,
        MetadataService,
        TicketsService,
        MarketService,
        NetworkService,
        RedisService,
        ExchangeRateService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .overrideProvider(ExchangeRateService)
      .useValue(new (jest.fn())())
      .compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('.extendTicket', () => {
    let ticket: Ticket;

    beforeEach(async () => {
      ticket = await Ticket.create({
        network: net,
        owner: '0xOwner',
        index: 0,
      });
    });

    it('should extend ticket correctly when select=[matured]', async () => {
      await service.extendTicket(ticket, []);
      expect(ticket.matured).toBeFalsy();

      ticket.matureAt = moment().add(1, 'day').toISOString();
      await service.extendTicket(ticket, ['matured']);
      expect(ticket.matured).toEqual(false);

      ticket.matureAt = moment().subtract(1, 'day').toISOString();
      await service.extendTicket(ticket, ['matured']);
      expect(ticket.matured).toEqual(true);
    });

    it('should extend ticket correctly when select=[expired]', async () => {
      await service.extendTicket(ticket, []);
      expect(ticket.expired).toBeFalsy();

      ticket.joinBy = moment().add(1, 'day').toISOString();
      await service.extendTicket(ticket, ['expired']);
      expect(ticket.expired).toBeFalsy();

      ticket.joinBy = moment().subtract(1, 'day').toISOString();
      await service.extendTicket(ticket, ['expired']);
      expect(ticket.expired).toBeTruthy();

      ticket.joinBy = undefined;
      ticket.drained = true;
      await service.extendTicket(ticket, ['expired']);
      expect(ticket.expired).toBeTruthy();
    });

    it('should extend ticket correctly when select=[cancelling]', async () => {
      await service.extendTicket(ticket, []);
      expect(ticket.cancelling).toBeFalsy();

      ticket.cancelAt = moment().add(1, 'day').toISOString();
      await service.extendTicket(ticket, ['cancelling']);
      expect(ticket.cancelling).toBeTruthy();

      ticket.cancelAt = moment().subtract(1, 'day').toISOString();
      await service.extendTicket(ticket, ['cancelling']);
      expect(ticket.cancelling).toBeFalsy();
    });

    it('should extend ticket correctly when select=[cancelled]', async () => {
      await service.extendTicket(ticket, []);
      expect(ticket.cancelled).toBeFalsy();

      ticket.cancelAt = moment().add(1, 'day').toISOString();
      await service.extendTicket(ticket, ['cancelled']);
      expect(ticket.cancelled).toBeFalsy();

      ticket.cancelAt = moment().subtract(1, 'day').toISOString();
      await service.extendTicket(ticket, ['cancelled']);
      expect(ticket.cancelled).toBeTruthy();
    });
  });
});

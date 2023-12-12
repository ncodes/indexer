import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import { DBService } from '../../db/db.service';
import Ticket from '../../models/ticket';
import TicketSlash from '../../models/ticket_slash';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import { MarketService } from '../markets/market.service';
import { TicketsService } from './tickets.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetLogo = jest.fn();
const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    getLogo: mockGetLogo,
    tryToUsd: mockTryToUsd,
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
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .overrideProvider(ExchangeRateService)
      .useValue(new (jest.fn())())
      .overrideProvider(NetworkService)
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

      ticket.matureAt = moment().subtract(1, 'day').toISOString();
      ticket.joined = true;
      await service.extendTicket(ticket, ['matured']);
      expect(ticket.matured).toEqual(false);
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

    it('should extend ticket correctly when select=[slashedAmt]', async () => {
      await TicketSlash.create({ network: ticket.network, owner: ticket.owner, index: ticket.index, amount: '100' });
      await TicketSlash.create({ network: ticket.network, owner: ticket.owner, index: ticket.index, amount: '1' });
      await service.extendTicket(ticket, ['slashedAmt']);
      expect(ticket.slashedAmt).toEqual('101');
    });

    it('should extend ticket correctly when select=[slashedAmtUsd]', async () => {
      await TicketSlash.create({ network: ticket.network, owner: ticket.owner, index: ticket.index, amount: '100' });
      await TicketSlash.create({ network: ticket.network, owner: ticket.owner, index: ticket.index, amount: '1' });
      ticket.slashedAmt = '101';
      mockTryToUsd.mockResolvedValue(10);
      await service.extendTicket(ticket, ['slashedAmtUsd']);
      expect(ticket.slashedAmtUsd).toEqual(10);
    });

    it('should extend ticket correctly when select=[bondUsd]', async () => {
      ticket.bond = '100';
      mockTryToUsd.mockResolvedValue(10);
      await service.extendTicket(ticket, ['bondUsd']);
      expect(ticket.bondUsd).toEqual(10);
    });
  });
});

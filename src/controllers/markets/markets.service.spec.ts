import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import Swap from '../../models/swap';
import { TokenLists } from '../../common/token_list';
import Liquidity from '../../models/liquidity';
import MarketPrice from '../../models/market_price';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockMarkets = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {
    getContracts: jest.fn().mockReturnValue({
      marketCore: {
        markets: mockMarkets,
      },
    }),
  };
});

const mockGetLogo = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    getLogo: mockGetLogo,
  };
});

describe('MarketsService', () => {
  let module: TestingModule;
  let service: MarketService;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const base = '0xBase';
  const quote = '0xQuote';
  const marketAddress = '0xMarket';
  const creator = '0xCreator';
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
      providers: [MarketService, NetworkService, MetadataService, ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<MarketService>(MarketService);
  });

  describe('.extendMarket', () => {
    let market: Market;
    beforeEach(async () => {
      market = new Market({
        address: marketAddress,
        creator: creator,
        network: net,
        baseAddress: base,
        quoteAddress: quote,
      });
    });

    it(`should return correct value when select=['numProviders']`, async () => {
      await service.extendMarket(market, ['numProviders']);
      expect(market.numProviders).toBe('0');
      await Liquidity.create({ marketAddress: marketAddress, network: net, amount: '1' });
      await Liquidity.create({ marketAddress: marketAddress, network: net, amount: '1' });
      await service.extendMarket(market, ['numProviders']);
      expect(market.numProviders).toBe('2');
    });

    it(`should return correct value when select=['totalLiquidity']`, async () => {
      await service.extendMarket(market, ['totalLiquidity']);
      expect(market.totalLiquidity).toBe('0');
      await Liquidity.create({ marketAddress: marketAddress, network: net, amount: '10' });
      await Liquidity.create({ marketAddress: marketAddress, network: net, amount: '15' });
      await service.extendMarket(market, ['totalLiquidity']);
      expect(market.totalLiquidity).toBe('25');
    });

    it(`should return correct value when select=['lowestPrice24h', 'highestPrice24h']`, async () => {
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '2' });
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '1' });
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '3' });
      await service.extendMarket(market, ['lowestPrice24h', 'highestPrice24h']);
      expect(market.lowestPrice24h).toBe('1');
      expect(market.highestPrice24h).toBe('3');
    });

    it(`should return correct value when select=['totalSwaps24h']`, async () => {
      await Swap.create({ network: net, marketAddress, createdAt: moment().subtract(86399, 'seconds').toISOString() });
      await Swap.create({ network: net, marketAddress, createdAt: moment().subtract(86400, 'seconds').toISOString() });
      await service.extendMarket(market, ['totalSwaps24h']);
      expect(market.totalSwaps24h).toBe('1');
    });

    it(`should return correct value when select=['volume24h']`, async () => {
      await Swap.create({
        network: net,
        marketAddress,
        amount: '1',
        createdAt: moment().subtract(86399, 'seconds').toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress,
        amount: '4',
        createdAt: moment().subtract(86400, 'seconds').toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress,
        amount: '2',
        createdAt: moment().subtract(86300, 'seconds').toISOString(),
      });
      await service.extendMarket(market, ['volume24h']);
      expect(market.volume24h).toBe('3');
    });

    it(`should return correct value when select=['priceChange']`, async () => {
      const now = moment();
      await MarketPrice.create({
        network: net,
        marketAddress,
        price: '2',
        createdAt: now.clone().subtract(86400, 's').toISOString(),
      });
      await MarketPrice.create({
        network: net,
        marketAddress,
        price: '3',
        createdAt: now.clone().subtract(86401, 's').toISOString(),
      });
      await MarketPrice.create({
        network: net,
        marketAddress,
        price: '4',
        createdAt: now.clone().toISOString(),
      });
      await service.extendMarket(market, ['priceChange']);
      expect(market.priceChange).toBe(100);
    });

    it(`should return correct value when select=['baseLogo or quoteLogo']`, async () => {
      TokenLists[net].tokens.push({ address: base, logoURI: 'logo_url' });
      TokenLists[net].tokens.push({ address: quote, logoURI: 'logo_url_quote' });
      await service.extendMarket(market, ['baseLogo', 'quoteLogo']);
      expect(market.baseLogo).toBe('logo_url');
      expect(market.quoteLogo).toBe('logo_url_quote');
    });
  });
});

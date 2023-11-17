import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import { DBService } from '../../db/DBService';
import { NotifierService } from '../../jobs/mailer/NotifierService';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import MarketPrice from '../../models/market_price';
import Meta, { MetaKeys } from '../../models/meta';
import Swap from '../../models/swap';
import { pow10 } from '../../network/common';
import NetworkService from '../../network/network.service';
import { ExchangeRateService } from '../../services/exchange_rate.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import { MarketService } from './market.service';

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

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [
        MarketService,
        NetworkService,
        MetadataService,
        NotifierService,
        ConfigService,
        ExchangeRateService,
        RedisService,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkServiceMock)
      .useValue(new NetworkServiceMock())
      .overrideProvider(NotifierService)
      .useValue(new (jest.fn())())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .compile();

    service = module.get<MarketService>(MarketService);

    const key = Meta.makeNetKey(net, MetaKeys.ContractsParams);
    await Meta.update(key, JSON.stringify({}));
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

    it(`should return correct value when select=['lowestPrice24h', 'highestPrice24h']`, async () => {
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '2' });
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '1' });
      await Liquidity.create({ marketAddress, network: net, amount: '1', price: '3' });

      await service.extendMarket(market, ['lowestPrice24h', 'highestPrice24h']);
      expect(market.lowestPrice24h).toBe('1');
      expect(market.highestPrice24h).toBe('3');
    });

    it(`should return correct value when select=['lowestPrice']`, async () => {
      market.lowestPrice = '20';

      const tokenInfo = { decimals: 18, price: 5, network: net, logoURI: '', name: '' };
      const mockGetTokenInfo = jest.spyOn(module.get(MetadataService), 'getTokenInfo').mockResolvedValue(tokenInfo);
      const mockTryToUsd = jest.spyOn(module.get(MetadataService), 'tryToUsd').mockResolvedValue(100);

      await service.extendMarket(market, ['lowestPrice']);
      expect(market.lowestPriceUsd).toBe(100);
      expect(mockGetTokenInfo).toBeCalledWith(net, quote);
      expect(mockTryToUsd).toBeCalledWith(net, market.lowestPrice, quote, tokenInfo);
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
        valueUsd: '1',
        createdAt: moment().subtract(86399, 'seconds').toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress,
        valueUsd: '4',
        createdAt: moment().subtract(86400, 'seconds').toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress,
        valueUsd: '2',
        createdAt: moment().subtract(86300, 'seconds').toISOString(),
      });

      jest
        .spyOn(module.get(MetadataService), 'getTokenInfo')
        .mockResolvedValue({ decimals: 18, price: 5, network: net, logoURI: '', name: '' });

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

    describe(`select=['baseLogo or quoteLogo']`, () => {
      it(`should return correct value when token was found in local list`, async () => {
        jest.spyOn(module.get(MetadataService), 'getTokenInfo').mockImplementation((network, address) => {
          return { '0xBase': { logoURI: 'logo_url' }, '0xQuote': { logoURI: 'logo_url_quote' } }[address] as any;
        });

        await service.extendMarket(market, ['baseLogo', 'quoteLogo']);
        expect(market.baseLogo).toBe('logo_url');
        expect(market.quoteLogo).toBe('logo_url_quote');
      });
    });

    it(`should return correct value when select=['amountSwapped']`, async () => {
      market.amountSwapped = pow10(18).mul(100).toString();
      jest
        .spyOn(module.get(MetadataService), 'getTokenInfo')
        .mockResolvedValue({ decimals: 18, price: 5, network: net, logoURI: '', name: '' });
      await service.extendMarket(market, ['amountSwapped']);
      expect(market.amountSwappedUsd).toBe(500);
    });

    it(`should return correct value when select=['totalLiquidity']`, async () => {
      market.totalLiquidity = '20';

      const tokenInfo = { decimals: 18, price: 5, network: net, logoURI: '', name: '' };
      const mockGetTokenInfo = jest.spyOn(module.get(MetadataService), 'getTokenInfo').mockResolvedValue(tokenInfo);
      const mockTryToUsd = jest.spyOn(module.get(MetadataService), 'tryToUsd').mockResolvedValue(100);

      await service.extendMarket(market, ['totalLiquidity']);
      expect(market.totalLiquidityUsd).toBe(100);
      expect(mockGetTokenInfo).toBeCalledWith(net, base);
      expect(mockTryToUsd).toBeCalledWith(net, market.totalLiquidity, base, tokenInfo);
    });
  });
});

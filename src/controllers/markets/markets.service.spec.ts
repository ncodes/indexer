import { Test, TestingModule } from '@nestjs/testing';
import { MarketsService } from './markets.service';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BigNumber } from 'ethers';
import * as moment from 'moment';
import { DBService } from '../../db/DBService';
import Market from '../../models/market';
import Swap from '../../models/swap';
import { TokenList } from '../../common/token_list';

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

describe('MarketsService', () => {
  let module: TestingModule;
  let service: MarketsService;
  const db = DBService.getForTest();
  const net = 'ethereum';
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
      providers: [MarketsService, NetworkService, MetadataService, ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<MarketsService>(MarketsService);
  });

  describe('.normalizeMarket', () => {
    it('return expected fields', () => {
      const contractMarket = {
        creator: '0xAddr',
        createdAt: BigNumber.from('4567'),
        base: {
          addr: '0xBase',
          isLocal: false,
        },
        quote: {
          addr: '0xQuote',
          isLocal: true,
        },
        numOrders: BigNumber.from(1),
        numDisputes: BigNumber.from(12),
        permPut: false,
        permSwap: true,
        permMediate: false,
        commission: BigNumber.from(120),
        numMediators: BigNumber.from(3),
        mediatorBond: BigNumber.from(1220),
      };
      expect(service.normalizeMarket(contractMarket)).toEqual({
        creator: contractMarket.creator,
        createdAt: contractMarket.createdAt.toNumber(),
        baseAsset: {
          addr: contractMarket.base.addr,
          isLocal: contractMarket.base.isLocal,
        },
        quoteAsset: {
          addr: contractMarket.quote.addr,
          isLocal: contractMarket.quote.isLocal,
        },
        numDisputes: contractMarket.numDisputes.toNumber(),
        commission: contractMarket.commission.toNumber(),
        numMediators: contractMarket.numMediators.toNumber(),
      });
    });
  });

  describe('.merge', () => {
    it('should merge correctly', () => {
      const source = {
        provider: '0x123',
        baseAsset: {},
        quoteAsset: {},
        createdAt: 123,
      };
      const market: any = {
        numOrders: 12,
      };
      service.merge(source as any, market as any);
      expect(market.numOrders).toEqual(market.numOrders);
      expect(market.provider).toEqual(source.provider);
    });
  });

  describe('.extendMarket', () => {
    describe('when noMerge=false', () => {
      it(
        'should attempt to merge contract market object into the given' + ' market object',
        async () => {
          TokenList[net].tokens.push({
            address: '0xBase',
            logoURI: 'https://logo.png',
          } as any);
          TokenList[net].tokens.push({
            address: '0xQuote',
            logoURI: 'https://logo2.png',
          } as any);

          let market: Market = await Market.create({
            marketId: '0x123',
            creator: '0xUser',
            network: net,
            baseAddress: '0xBase',
            quoteAddress: '0xQuote',
            isBaseLocal: false,
            isQuoteLocal: false,
          });

          // Mocks
          const contractMarket = {
            permPut: true,
            permSwap: true,
            creator: '0x12345',
          };
          const mockMarket = jest.fn();
          mockGetMarketCore.mockResolvedValue({ markets: mockMarket });
          mockMarket.mockResolvedValue(contractMarket);
          mockGetLogo.mockResolvedValue('https://logo.png');

          await Swap.create({
            network: market.network,
            marketId: market.marketId,
            instant: true,
            amount: '10',
          });
          await Swap.create({
            network: market.network,
            marketId: market.marketId,
            instant: true,
            amount: '5',
          });
          await Swap.create({
            network: market.network,
            marketId: market.marketId,
            instant: false,
            amount: '1',
          });
          await Swap.create({
            network: market.network,
            marketId: market.marketId,
            instant: false,
            createdAt: moment().subtract(1440, 'm').toISOString(),
          });

          await service.extendMarket(market, false);
          expect(mockGetMarketCore).toHaveBeenCalledWith(net);
          expect(mockMarket).toHaveBeenCalledWith(market.marketId);
          expect(market.creator).toEqual('0x12345');
          expect(market.network).toEqual(net);
          expect(market.baseLogo).toEqual('https://logo.png');
          expect(market.quoteLogo).toEqual('https://logo2.png');
          expect(market.numProviders).toBeDefined();
          expect(market.totalLiquidity).toBeDefined();
          expect(market.lowestPrice24h).toBeDefined();
          expect(market.highestPrice24h).toBeDefined();
          expect(market.lowestPrice).toBeDefined();
          expect(market.priceChange).toBeDefined();
          expect(market.totalSwaps24h).toEqual('2');
          expect(market.volume24h).toEqual('15');

          // When market base and quote asset are not all on-chain
          market = await Market.updateById(market.id, {
            isBaseLocal: false,
            isQuoteLocal: true,
          });
          await service.extendMarket(market, false);
          expect(market.totalSwaps24h).toEqual('1');
          expect(market.volume24h).toEqual('1');
        },
      );
    });

    it('should not merge if noMerge=true', async () => {
      TokenList['0xBase'] = { image: 'https://logo.png' };
      TokenList['0xQuote'] = { image: 'https://logo2.png' };

      const market: Market = new Market({
        marketId: '0x123',
        creator: '0xUser',
        network: net,
        baseAddress: '0xBase',
        quoteAddress: '0xQuote',
      });

      // Mocks
      const contractMarket = {
        permPut: true,
        permSwap: true,
        creator: '0x12345',
      };
      const mockMarket = jest.fn();
      mockGetMarketCore.mockResolvedValue({ markets: mockMarket });
      mockMarket.mockResolvedValue(contractMarket);
      mockGetLogo.mockResolvedValue('https://logo.png');

      await service.extendMarket(market, true);
      expect(mockGetMarketCore).not.toHaveBeenCalledWith(net);
      expect(mockMarket).not.toHaveBeenCalledWith(market.marketId);
      expect(market.permPut).toBeUndefined();
      expect(market.permSwap).toBeUndefined();
      expect(market.creator).toEqual('0xUser');
      expect(market.network).toEqual(net);
      expect(market.baseLogo).toEqual('https://logo.png');
      expect(market.quoteLogo).toEqual('https://logo2.png');
      expect(market.numProviders).toBeDefined();
      expect(market.totalLiquidity).toBeDefined();
      expect(market.lowestPrice24h).toBeDefined();
      expect(market.highestPrice24h).toBeDefined();
      expect(market.priceChange).toBeDefined();
    });
  });
});

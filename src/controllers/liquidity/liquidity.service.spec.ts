import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { LiquidityService } from './liquidity.service';
import { MarketsService } from '../markets/markets.service';
import Liquidity from '../../models/liquidity';
import { BigNumber } from 'ethers';
import Market from '../../models/market';
import Swap from '../../models/swap';
import * as moment from 'moment';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockGetCore = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return { getCore: mockGetCore };
});

const mockGetLogo = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    getLogo: mockGetLogo,
  };
});

describe('LiquidityService', () => {
  let module: TestingModule;
  let service: LiquidityService;
  const db = DBService.getForTest();
  const net = 'net1';
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
    mockGetCore.mockReset();
    mockGetLogo.mockReset();

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [LiquidityService, MarketsService, NetworkService, MetadataService, ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<LiquidityService>(LiquidityService);
  });

  describe('.merge', () => {
    it('should merge correctly', () => {
      const source = {
        marketId: '0x123',
      };
      const liquidity: any = {
        network: net,
        provider: '0xProvider',
      };
      service.merge(source as any, liquidity as any);
      expect(liquidity.network).toEqual(liquidity.network);
      expect(liquidity.provider).toEqual(liquidity.provider);
      expect(liquidity.marketId).toEqual(source.marketId);
    });
  });

  describe('.extendLiquidity', () => {
    describe('when noMerge=false', () => {
      it(
        'should attempt to merge contract market object into the given' + ' market object',
        async () => {
          const market = await Market.create({
            marketId: '0x123',
            network: net,
          });
          const liquidity: Liquidity = new Liquidity({
            network: net,
            marketId: market.marketId,
            provider: '0xProvider',
          });

          const contractLiquidity = {
            paused: true,
            openOrders: BigNumber.from(1),
          };
          const mockGetLiquidity = jest.fn();
          mockGetCore.mockReturnValue({ getLiquidity: mockGetLiquidity });
          mockGetLiquidity.mockResolvedValue(contractLiquidity);
          jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();

          await Swap.create({
            network: net,
            marketId: market.marketId,
            provider: '0xProvider',
            amount: '100',
          });
          await Swap.create({
            network: net,
            marketId: market.marketId,
            provider: '0xProvider',
            instant: true,
            amount: '100',
          });
          await Swap.create({
            network: net,
            marketId: market.marketId,
            provider: '0xProvider',
            instant: true,
            createdAt: moment().subtract(1440, 'm').toISOString(),
            amount: '100',
          });

          await service.extendLiquidity(liquidity, false);
          expect(mockGetCore).toHaveBeenCalledWith(net);
          expect(mockGetLiquidity).toHaveBeenCalledWith(liquidity.marketId, liquidity.provider);
          expect(liquidity.network).toEqual(net);
          expect(liquidity.marketId).toEqual('0x123');
          expect(liquidity.provider).toEqual('0xProvider');
          expect(liquidity.market).toBeDefined();
          expect(liquidity.market.id).toEqual(market.id);
          expect(liquidity.totalSwaps).toEqual('3');
          expect(liquidity.totalSwaps24h).toEqual('2');
          expect(liquidity.totalInstantSwaps).toEqual('2');
          expect(liquidity.totalInstantSwaps24h).toEqual('1');
          expect(liquidity.volume24h).toEqual('200');
          expect(liquidity.volumeInstant24h).toEqual('100');
        },
      );

      describe('when noMerge=true', () => {
        it(
          'should attempt to merge contract market object into the given' + ' market object',
          async () => {
            const market = await Market.create({
              marketId: '0x123',
              network: net,
            });
            const liquidity: Liquidity = new Liquidity({
              network: net,
              marketId: market.marketId,
              provider: '0xProvider',
            });

            jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();

            await service.extendLiquidity(liquidity, true);
            expect(liquidity.network).toEqual(net);
            expect(liquidity.marketId).toEqual('0x123');
            expect(liquidity.provider).toEqual('0xProvider');
            expect(liquidity.market).toBeDefined();
            expect(liquidity.market.id).toEqual(market.id);
          },
        );
      });

      describe('liquidity market was not found', () => {
        it(
          'should attempt to merge contract market object into the given' + ' market object',
          async () => {
            const liquidity: Liquidity = new Liquidity({
              network: net,
              marketId: '0x123',
              provider: '0xProvider',
            });

            jest.spyOn(module.get(MarketsService), 'extendMarket').mockResolvedValue();

            await expect(service.extendLiquidity(liquidity, true)).rejects.toEqual(
              new Error('market not found'),
            );
          },
        );
      });
    });
  });
});

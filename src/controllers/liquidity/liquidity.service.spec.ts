import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { LiquidityService } from './liquidity.service';
import { MarketsService } from '../markets/markets.service';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';

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

  describe('.extendLiquidity', () => {
    describe('when noMerge=false', () => {
      describe('when noMerge=true', () => {
        it('should not attempt to merge contract market object with db object', async () => {
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
        });
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

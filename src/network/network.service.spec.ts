import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotifierService } from '../jobs/mailer/NotifierService';
import { DBService } from '../db/DBService';
import NetworkService from './network.service';
import Swap from '../models/swap';
import Market, { AssetType } from '../models/market';
import { BigNumber } from 'ethers';
import Meta, { FeeName } from '../models/meta';
import AssetRegistry from '../models/asset_registry';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

const mockDecimals = jest.fn();
const MockERC20Contract = jest.fn().mockImplementation(() => {
  return { decimals: mockDecimals };
});

describe('NetworkService', () => {
  const marketAddress = '0xMarket';
  const baseAsset = '0xBase';
  const quoteAsset = '0xQuote';
  let module: TestingModule;
  const net = 'ethereum';
  let service: NetworkService;
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
    mockNotify.mockReset();
    mockDecimals.mockReset();

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [NetworkService, NotifierService, ConfigService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .compile();

    service = module.get<NetworkService>(NetworkService);
  });

  describe('.getSwapFeeInfo', () => {
    it('should return error when market was not found', async () => {
      const swap = new Swap({ network: net, marketAddress: marketAddress });
      await expect(service.getSwapFeeInfo(null, swap)).rejects.toEqual(
        new Error('market not found'),
      );
    });

    describe('swap.instant=true', () => {
      describe('base and quote assets are not stable', () => {
        it('should use `instantSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketAddress,
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: true,
          });

          await Market.create({
            address: swap.marketAddress,
            commission: 1,
            network: net,
            baseAddress: baseAsset,
            baseType: AssetType.ERC20,
            quoteAddress: quoteAsset,
            quoteType: AssetType.ERC20,
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await Meta.create(Meta.makeProtocolFeeKey(net, FeeName.InstantSwapFeeBp), '12');
          const res = service.getSwapFeeInfo(null, swap);
          await expect(res).resolves.toBeDefined();

          expect((await res).cost).toEqual('10000000000000000000');
          expect((await res).costCharged).toBeFalsy();
          expect((await res).chargedAmount).toEqual('10000000000000000000');
          expect((await res).protocolFeeBP).toEqual(12);
          expect((await res).protocolFee).toEqual('12000000000000000');
          expect((await res).marketFeeBP).toEqual(1);
          expect((await res).marketFee).toEqual('1000000000000000');
          expect((await res).totalFee).toEqual('13000000000000000');
        });
      });

      describe('base and quote assets are stable', () => {
        it('should use `stableSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketAddress: marketAddress,
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: true,
          });

          await Market.create({
            address: swap.marketAddress,
            network: net,
            commission: 1,
            baseAddress: baseAsset,
            baseType: AssetType.ERC20,
            quoteAddress: quoteAsset,
            quoteType: AssetType.ERC20,
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await AssetRegistry.create({ network: net, address: baseAsset, stable: true });
          await AssetRegistry.create({ network: net, address: quoteAsset, stable: true });
          await Meta.create(Meta.makeProtocolFeeKey(net, FeeName.StableSwapFeeBp), '12');

          const res = service.getSwapFeeInfo(null, swap);
          await expect(res).resolves.toBeDefined();

          expect((await res).cost).toEqual('10000000000000000000');
          expect((await res).costCharged).toBeFalsy();
          expect((await res).chargedAmount).toEqual('10000000000000000000');
          expect((await res).protocolFeeBP).toEqual(12);
          expect((await res).protocolFee).toEqual('12000000000000000');
          expect((await res).marketFeeBP).toEqual(1);
          expect((await res).marketFee).toEqual('1000000000000000');
          expect((await res).totalFee).toEqual('13000000000000000');
        });
      });
    });

    describe('swap.instant=false', () => {
      describe('base and quote assets are stable', () => {
        it('should use `syntheticSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketAddress: marketAddress,
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: false,
          });

          await Market.create({
            address: swap.marketAddress,
            network: net,
            commission: 1,
            baseType: AssetType.ERC20,
            baseAddress: baseAsset,
            quoteType: AssetType.ERC20,
            quoteAddress: quoteAsset,
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await AssetRegistry.create({ network: net, address: baseAsset, stable: true });
          await AssetRegistry.create({ network: net, address: quoteAsset, stable: true });
          await Meta.create(Meta.makeProtocolFeeKey(net, FeeName.SynthSwapFeeBp), '12');

          const res = service.getSwapFeeInfo(null, swap);
          await expect(res).resolves.toBeDefined();

          expect((await res).cost).toEqual('10000000000000000000');
          expect((await res).costCharged).toBeFalsy();
          expect((await res).chargedAmount).toEqual('10000000000000000000');
          expect((await res).protocolFeeBP).toEqual(12);
          expect((await res).protocolFee).toEqual('12000000000000000');
          expect((await res).marketFeeBP).toEqual(1);
          expect((await res).marketFee).toEqual('1000000000000000');
          expect((await res).totalFee).toEqual('13000000000000000');
        });
      });
    });
  });

  describe('.getTokenDecimals', () => {
    it('should return decimal', async () => {
      (service.newContract as any) = () => {
        return new MockERC20Contract();
      };
      mockDecimals.mockResolvedValue(BigNumber.from(18));
      expect(await service.getTokenDecimals(null, 'address')).toEqual(BigNumber.from(18));
    });
  });
});

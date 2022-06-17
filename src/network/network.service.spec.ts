import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotifierService } from '../jobs/mailer/NotifierService';
import { DBService } from '../db/DBService';
import NetworkService from './network.service';
import Swap from '../models/swaps';
import Market from '../models/market';
import { BigNumber } from 'ethers';
import Meta from '../models/meta';

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
  let module: TestingModule;
  const net = 'ethereumMainnet';
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
      const swap = new Swap({ network: net, marketId: '0xMarket' });
      await expect(service.getSwapFeeInfo(null, swap)).rejects.toEqual(
        new Error('market not found'),
      );
    });

    describe('swap.instant=true', () => {
      describe('base and quote assets are not stable', () => {
        it('should return use `instantSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketId: '0xMarket',
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: true,
          });

          await Market.create({
            marketId: swap.marketId,
            commission: 1,
            network: net,
            baseAddress: '0xBase',
            isBaseLocal: false,
            quoteAddress: '0xQuote',
            isQuoteLocal: false,
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await Meta.create(Meta.makeProtocolFeeKey(net, 'instantSwapFee'), '12');
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
        it('should return use `stableSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketId: '0xMarket',
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: true,
          });

          await Market.create({
            marketId: swap.marketId,
            network: net,
            commission: 1,
            baseAddress: '0xBase',
            isBaseLocal: false,
            quoteAddress: '0xQuote',
            isQuoteLocal: false,
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await Meta.create(
            Meta.makeStableAssetsKey(net),
            JSON.stringify({ '0xBase': 1, '0xQuote': 1 }),
          );

          await Meta.create(Meta.makeProtocolFeeKey(net, 'stableSwapFee'), '12');
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
        it('should return use `p2pSwapFee` to calculate protocol fee', async () => {
          const swap = new Swap({
            network: net,
            marketId: '0xMarket',
            price: '1000000000000000000',
            amount: '10000000000000000000',
            instant: false,
          });

          await Market.create({
            marketId: swap.marketId,
            network: net,
            commission: 1,
            baseAddress: '0xBase',
            quoteAddress: '0xQuote',
          });

          (service.newContract as any) = () => {
            return new MockERC20Contract();
          };
          mockDecimals.mockResolvedValue(BigNumber.from(18));

          await Meta.create(
            Meta.makeStableAssetsKey(net),
            JSON.stringify({ '0xBase': 1, '0xQuote': 1 }),
          );

          await Meta.create(Meta.makeProtocolFeeKey(net, 'p2pSwapFee'), '12');
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

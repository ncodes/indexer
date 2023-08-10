import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { LiquidityService } from './liquidity.service';
import Market from '../../models/market';
import Liquidity from '../../models/liquidity';
import { MarketService } from '../markets/market.service';
import Swap from '../../models/swap';
import * as moment from 'moment';
import MarketPrice from '../../models/market_price';
import { MetadataService } from '../../services/metadata/metadata.service';

const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

describe('LiquidityService', () => {
  let module: TestingModule;
  let service: LiquidityService;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const marketAddress = '0xMarket';
  const provider = '0xProvider';

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

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [LiquidityService, MarketService, MetadataService],
    })
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<LiquidityService>(LiquidityService);
  });

  describe('.extendLiquidity', () => {
    let market: Market;
    let liquidity: Liquidity;

    beforeEach(async () => {
      market = await Market.create({
        address: marketAddress,
        network: net,
      });
      liquidity = await Liquidity.create({
        network: net,
        marketAddress: market.address,
        provider,
      });
    });

    it(`should return correct value when select=['totalSwaps24h']`, async () => {
      await Swap.create({ network: net, marketAddress, provider, lid: 0 });
      await Swap.create({ network: net, marketAddress, provider, lid: 1 });
      await Swap.create({
        network: net,
        marketAddress,
        provider,
        lid: 1,
        createdAt: moment().subtract(86400, 's').toISOString(),
      });
      await expect(service.extendLiquidity(liquidity, ['totalSwaps24h'])).resolves.toBeUndefined();
      expect(liquidity.totalSwaps24h).toBe('2');

      liquidity = await Liquidity.updateById(liquidity.id, { lid: 1 });
      await expect(service.extendLiquidity(liquidity, ['totalSwaps24h'])).resolves.toBeUndefined();
      expect(liquidity.totalSwaps24h).toBe('1');
    });

    it(`should return correct value when select=['volume24h']`, async () => {
      await Swap.create({ network: net, marketAddress, provider, lid: 0, amount: '5' });
      await Swap.create({ network: net, marketAddress, provider, lid: 1, amount: '2' });
      await Swap.create({
        network: net,
        marketAddress,
        provider,
        lid: 1,
        amount: '10',
        createdAt: moment().subtract(86400, 's').toISOString(),
      });
      await expect(service.extendLiquidity(liquidity, ['volume24h'])).resolves.toBeUndefined();
      expect(liquidity.volume24h).toBe('7');

      liquidity = await Liquidity.updateById(liquidity.id, { lid: 1 });
      await expect(service.extendLiquidity(liquidity, ['volume24h'])).resolves.toBeUndefined();
      expect(liquidity.volume24h).toBe('2');
    });

    it(`should return correct value when select=['priceChange']`, async () => {
      const now = moment();
      await MarketPrice.create({
        network: net,
        marketAddress,
        provider,
        price: '2',
        createdAt: now.clone().subtract(86400, 's').toISOString(),
      });
      await MarketPrice.create({
        network: net,
        marketAddress,
        provider,
        lid: 1,
        price: '3',
        createdAt: now.clone().subtract(86401, 's').toISOString(),
      });
      await MarketPrice.create({
        network: net,
        marketAddress,
        provider,
        price: '4',
        createdAt: now.clone().toISOString(),
      });

      await expect(service.extendLiquidity(liquidity, ['priceChange'])).resolves.toBeUndefined();
      expect(liquidity.priceChange).toBe(100);

      await MarketPrice.create({
        network: net,
        marketAddress,
        provider,
        lid: 1,
        price: '4',
        createdAt: now.clone().toISOString(),
      });

      liquidity = await Liquidity.updateById(liquidity.id, { lid: 1 });
      await expect(service.extendLiquidity(liquidity, ['priceChange'])).resolves.toBeUndefined();
      expect(liquidity.priceChange).toBe(33.333333333333336);
    });

    it(`should return correct value when select=['priceUsd']`, async () => {
      mockTryToUsd.mockResolvedValue('100');
      await Swap.create({ network: net, price: '100' });
      liquidity = await Liquidity.updateById(liquidity.id, { price: '100' });
      await expect(service.extendLiquidity(liquidity, ['priceUsd'])).resolves.toBeUndefined();
      expect(liquidity.priceUsd).toBe('100');
    });
  });
});

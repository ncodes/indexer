import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { toDec } from '../../common/common';
import { DBService } from '../../db/db.service';
import Liquidity from '../../models/liquidity';
import Market, { AssetType } from '../../models/market';
import Point, { PointAction } from '../../models/point';
import Swap from '../../models/swap';
import User from '../../models/user';
import { pow10, powOf, toBigInt } from '../../network/common';
import { AuthService } from '../auth/auth.service';
import { PointService, ReferrerPointSharePct } from './point.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

jest.mock('./data/points.ts', () => {
  return {
    PointMap: {
      'swap:instant': 10,
      'swap:interactive': 15,
      'swap:0xMarket': 20,
      'swap:level:0xMarket': 1000,
      'liq:instant': 10,
      'liq:interactive': 15,
      'liq:0xMarket': 20,
      'liq:level:0xMarket': 1000,
      'test:zero': 0,
      generic: 10,
    },
  };
});

// mock AuthService
const AuthServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('PointService', () => {
  let module: TestingModule;
  let service: PointService;
  const db = DBService.getForTest();
  const marketAddr = '0xMarket';
  const marketAddr2 = '0xMarket2';
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
      providers: [ConfigService, PointService, AuthService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(AuthService)
      .useValue(new AuthServiceMock())
      .compile();

    service = module.get<PointService>(PointService);
  });

  describe('.grantOnSwap', () => {
    describe('network has been ignored', () => {
      it('should return false', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr2,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });

        cfgObj['app.ignoreNetworkPoint'] = 'ethereum';

        const event = { transactionHash: '0xHash' };
        expect(await service.grantOnSwap(market, swap, undefined, event as any)).toBeFalsy();

        const point = await Point.find({});
        expect(point).toBeUndefined();
      });
    });

    describe('market is instant and counterparts have no referrer', () => {
      it('should grant correct point when market has a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InstantSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        expect(parseFloat(takerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));
        expect(takerPoint.action).toEqual(PointAction.InstantSwap);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.name).toEqual(
        //   `${PointAction.InstantSwap}:${event.transactionHash}:provider:${swap.provider}`,
        // );
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(providerPoint.address).toEqual('0xProvider');
        // expect(parseFloat(providerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));
        // expect(providerPoint.action).toEqual(PointAction.InstantSwap);
      });

      it('should grant correct point when market does not have a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr2,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InstantSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        expect(parseFloat(takerPoint.point)).toEqual(2000 * 10);
        expect(takerPoint.action).toEqual(PointAction.InstantSwap);
      });
    });

    describe('market is instant and counterparts have a referrer', () => {
      it('should grant correct points to referrer', async () => {
        await User.create({ address: '0xTaker', referrer: '0xTakerRef' });
        await User.create({ address: '0xProvider', referrer: '0xProviderRef' });

        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(parseFloat(takerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));

        const takerRefPoint = await Point.getByAddress('0xTakerRef');
        expect(takerRefPoint).not.toBeUndefined();
        expect(takerRefPoint.address).toEqual('0xTakerRef');
        expect(takerRefPoint.referrer).toEqual('0xTakerRef');
        expect(takerRefPoint.referee).toEqual('0xTaker');
        expect(parseFloat(takerRefPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20) * ReferrerPointSharePct);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(parseFloat(providerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));

        // const providerRefPoint = await Point.getByAddress('0xProviderRef');
        // expect(providerRefPoint).not.toBeUndefined();
        // expect(providerRefPoint.address).toEqual('0xProviderRef');
        // expect(providerRefPoint.referrer).toEqual('0xProviderRef');
        // expect(providerRefPoint.referee).toEqual('0xProvider');
        // expect(parseFloat(providerRefPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20) * ReferrerPointSharePct);
      });
    });

    describe('market is interactive (base is ERC20 and quote is SYNTH) and counterparts have no referrer', () => {
      it('should grant correct point when market has a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InteractiveSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        expect(parseFloat(takerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));
        expect(takerPoint.action).toEqual(PointAction.InteractiveSwap);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.name).toEqual(
        //   `${PointAction.InteractiveSwap}:${event.transactionHash}:provider:${swap.provider}`,
        // );
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(providerPoint.address).toEqual('0xProvider');
        // expect(parseFloat(providerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));
        // expect(providerPoint.action).toEqual(PointAction.InteractiveSwap);
      });

      it('should grant correct point when market does not have a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr2,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InteractiveSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        expect(parseFloat(takerPoint.point)).toEqual(2000 * 15);
        expect(takerPoint.action).toEqual(PointAction.InteractiveSwap);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.name).toEqual(
        //   `${PointAction.InteractiveSwap}:${event.transactionHash}:provider:${swap.provider}`,
        // );
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(providerPoint.address).toEqual('0xProvider');
        // expect(parseFloat(providerPoint.point)).toEqual(2000 * 15);
        // expect(providerPoint.action).toEqual(PointAction.InteractiveSwap);
      });
    });

    describe('market is interactive (base is ERC20 and quote is SYNTH) and counterparts have a referrer', () => {
      it('should grant correct point to referrer', async () => {
        await User.create({ address: '0xTaker', referrer: '0xTakerRef' });
        await User.create({ address: '0xProvider', referrer: '0xProviderRef' });

        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(parseFloat(takerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));

        const takerRefPoint = await Point.getByAddress('0xTakerRef');
        expect(takerRefPoint).not.toBeUndefined();
        expect(takerRefPoint.address).toEqual('0xTakerRef');
        expect(takerRefPoint.referrer).toEqual('0xTakerRef');
        expect(takerRefPoint.referee).toEqual('0xTaker');
        expect(parseFloat(takerRefPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20) * ReferrerPointSharePct);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(parseFloat(providerPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20));

        // const providerRefPoint = await Point.getByAddress('0xProviderRef');
        // expect(providerRefPoint).not.toBeUndefined();
        // expect(providerRefPoint.address).toEqual('0xProviderRef');
        // expect(providerRefPoint.referrer).toEqual('0xProviderRef');
        // expect(providerRefPoint.referee).toEqual('0xProvider');
        // expect(parseFloat(providerRefPoint.point)).toEqual(((2000 * 20) / 1000) * (2000 * 20) * ReferrerPointSharePct);
      });
    });

    describe('market is interactive (base is SYNTH and quote is ERC20)', () => {
      it('should grant correct point when market has a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.SYNTH,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
          price: powOf(2, 18).toString(),
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InteractiveSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        const cost = toDec(swap.amount)
          .mul(swap.price)
          .div(pow10(market.quoteDecimals + market.baseDecimals))
          .toNumber();
        expect(parseFloat(takerPoint.point)).toEqual(((cost * 20) / 1000) * (cost * 20));
        expect(takerPoint.action).toEqual(PointAction.InteractiveSwap);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.name).toEqual(
        //   `${PointAction.InteractiveSwap}:${event.transactionHash}:provider:${swap.provider}`,
        // );
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(providerPoint.address).toEqual('0xProvider');
        // expect(parseFloat(providerPoint.point)).toEqual(((cost * 20) / 1000) * (cost * 20));
        // expect(providerPoint.action).toEqual(PointAction.InteractiveSwap);
      });

      it('should grant correct point when market does not have a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr2,
          baseDecimals: 18,
          baseType: AssetType.SYNTH,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });
        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
          price: powOf(2, 18).toString(),
        });
        const event = { transactionHash: '0xHash' };
        await service.grantOnSwap(market, swap, undefined, event as any);

        const takerPoint = await Point.getByAddress('0xTaker');
        expect(takerPoint).not.toBeUndefined();
        expect(takerPoint.name).toEqual(`${PointAction.InteractiveSwap}:${event.transactionHash}:taker:${swap.taker}`);
        expect(takerPoint.network).toEqual('ethereum');
        expect(takerPoint.address).toEqual('0xTaker');
        const cost = toDec(swap.amount)
          .mul(swap.price)
          .div(pow10(market.quoteDecimals + market.baseDecimals))
          .toNumber();
        expect(parseFloat(takerPoint.point)).toEqual(cost * 15);
        expect(takerPoint.action).toEqual(PointAction.InteractiveSwap);

        // const providerPoint = await Point.getByAddress('0xProvider');
        // expect(providerPoint).not.toBeUndefined();
        // expect(providerPoint.name).toEqual(
        //   `${PointAction.InteractiveSwap}:${event.transactionHash}:provider:${swap.provider}`,
        // );
        // expect(providerPoint.network).toEqual('ethereum');
        // expect(providerPoint.address).toEqual('0xProvider');
        // expect(parseFloat(providerPoint.point)).toEqual(cost * 15);
        // expect(providerPoint.action).toEqual(PointAction.InteractiveSwap);
      });
    });

    describe('check return value', () => {
      it('should return false when market does not involve an ERC20 as base or quote (SYNTH/SYNTH)', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.SYNTH,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });

        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
          price: powOf(2, 18).toString(),
        });

        const event = { transactionHash: '0xHash' };
        await expect(service.grantOnSwap(market, swap, undefined, event as any)).resolves.toBeFalsy();
      });

      it('should return false when market does not involve an ERC20 as base or quote (SYNTH/ERC721)', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.SYNTH,
          quoteType: AssetType.ERC721,
          quoteDecimals: 18,
        });

        const swap = await Swap.create({
          amount: powOf(2000, 18).toString(),
          provider: '0xProvider',
          taker: '0xTaker',
          price: powOf(2, 18).toString(),
        });

        const event = { transactionHash: '0xHash' };
        await expect(service.grantOnSwap(market, swap, undefined, event as any)).resolves.toBeFalsy();
      });
    });
  });

  describe('.grantOnLiquidityUpdate', () => {
    describe('network has been ignored', () => {
      it('should return false', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.SYNTH,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });

        const liq = await Liquidity.create({
          amount: powOf(0, 18).toString(),
          provider: '0xProvider',
          marketAddress: market.address,
          lid: 1,
        });

        cfgObj['app.ignoreNetworkPoint'] = 'ethereum';

        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(10, 18))),
        ).resolves.toBeFalsy();
      });
    });

    it('should return false when market base is SYNTH', async () => {
      const market = await Market.create({
        network: 'ethereum',
        instant: true,
        address: marketAddr,
        baseDecimals: 18,
        baseType: AssetType.SYNTH,
        quoteType: AssetType.ERC20,
        quoteDecimals: 18,
      });

      const liq = await Liquidity.create({
        amount: powOf(0, 18).toString(),
        provider: '0xProvider',
        marketAddress: market.address,
        lid: 1,
      });

      await expect(
        service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(10, 18))),
      ).resolves.toBeFalsy();
    });

    it('should return false when market base is SYNTH', async () => {
      const market = await Market.create({
        network: 'ethereum',
        instant: true,
        address: marketAddr,
        baseDecimals: 18,
        baseType: AssetType.SYNTH,
        quoteType: AssetType.ERC20,
        quoteDecimals: 18,
      });

      const liq = await Liquidity.create({
        amount: powOf(0, 18).toString(),
        provider: '0xProvider',
        marketAddress: market.address,
        lid: 1,
      });

      await expect(
        service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(10, 18))),
      ).resolves.toBeFalsy();
    });

    describe('when liquidity is added and removed', () => {
      it('should grant correct point when market has a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });

        const liq = await Liquidity.create({
          amount: powOf(10, 18).toString(),
          provider: '0xProvider',
          marketAddress: market.address,
          lid: 1,
        });

        const liqAmt = 10;
        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint = await Point.getByAddress('0xProvider');
        expect(providerPoint).not.toBeUndefined();
        expect(providerPoint.name).toEqual(`${PointAction.LiquidityAdd}:${marketAddr}:0xProvider:1`);
        expect(providerPoint.network).toEqual('ethereum');
        expect(providerPoint.address).toEqual('0xProvider');

        const point = 20 * liqAmt;
        const expectedLevel = Math.max(1, point / 1000);
        const expectedPoints = expectedLevel * point;

        expect(parseFloat(providerPoint.point)).toEqual(expectedPoints);
        expect(providerPoint.action).toEqual(PointAction.LiquidityAdd);

        // Add liquidity again
        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint2 = await Point.getByAddress('0xProvider');
        expect(providerPoint2).not.toBeUndefined();
        expect(parseFloat(providerPoint2.point)).toEqual(expectedPoints * 2);

        // Should deduct point of liquidity is removed
        await expect(
          service.grantOnLiquidityUpdate(market, liq, false, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint3 = await Point.getByAddress('0xProvider');
        expect(providerPoint3).not.toBeUndefined();
        expect(parseFloat(providerPoint3.point)).toEqual(expectedPoints);
      });

      it('should grant correct point when market does not have a specific point per unit', async () => {
        const market = await Market.create({
          network: 'ethereum',
          instant: false,
          address: marketAddr2,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });

        const liq = await Liquidity.create({
          amount: powOf(10, 18).toString(),
          provider: '0xProvider',
          marketAddress: market.address,
          lid: 1,
        });

        const liqAmt = 10;
        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint = await Point.getByAddress('0xProvider');
        expect(providerPoint).not.toBeUndefined();
        expect(providerPoint.name).toEqual(`${PointAction.LiquidityAdd}:${marketAddr2}:0xProvider:1`);
        expect(providerPoint.network).toEqual('ethereum');
        expect(providerPoint.address).toEqual('0xProvider');

        const point = 15 * liqAmt;
        const expectedLevel = Math.max(1, point / 1000);
        const expectedPoints = expectedLevel * point;

        expect(parseFloat(providerPoint.point)).toEqual(expectedPoints);
        expect(providerPoint.action).toEqual(PointAction.LiquidityAdd);

        // Remove liquidity again
        await expect(
          service.grantOnLiquidityUpdate(market, liq, false, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint2 = await Point.getByAddress('0xProvider');
        expect(parseFloat(providerPoint2.point)).toEqual(0);
      });
    });

    describe('when liquidity is added and removed and provider has a referrer', () => {
      it('should grant correct point to referrer', async () => {
        await User.create({ address: '0xProvider', referrer: '0xProviderRef' });

        const market = await Market.create({
          network: 'ethereum',
          instant: true,
          address: marketAddr,
          baseDecimals: 18,
          baseType: AssetType.ERC20,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });

        const liq = await Liquidity.create({
          amount: powOf(10, 18).toString(),
          provider: '0xProvider',
          marketAddress: market.address,
          lid: 1,
        });

        const liqAmt = 10;
        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint = await Point.getByAddress('0xProvider');
        expect(providerPoint).not.toBeUndefined();
        expect(providerPoint.network).toEqual('ethereum');

        const point = 20 * liqAmt;
        const expectedLevel = Math.max(1, point / 1000);
        const expectedPoints = expectedLevel * point;

        expect(parseFloat(providerPoint.point)).toEqual(expectedPoints);
        expect(providerPoint.action).toEqual(PointAction.LiquidityAdd);

        let providerRefPoint = await Point.getByAddress('0xProviderRef');
        expect(providerRefPoint).not.toBeUndefined();
        expect(providerRefPoint.address).toEqual('0xProviderRef');
        expect(providerRefPoint.referee).toEqual('0xProvider');
        expect(parseFloat(providerRefPoint.point)).toEqual(expectedPoints * ReferrerPointSharePct);

        // Add liquidity again
        await expect(
          service.grantOnLiquidityUpdate(market, liq, true, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint2 = await Point.getByAddress('0xProvider');
        expect(providerPoint2).not.toBeUndefined();
        expect(parseFloat(providerPoint2.point)).toEqual(expectedPoints * 2);

        providerRefPoint = await Point.getByAddress('0xProviderRef');
        expect(providerRefPoint).not.toBeUndefined();
        expect(parseFloat(providerRefPoint.point)).toEqual(expectedPoints * ReferrerPointSharePct * 2);

        // Should deduct point of liquidity is removed
        await expect(
          service.grantOnLiquidityUpdate(market, liq, false, '0xProvider', toBigInt(powOf(liqAmt, 18))),
        ).resolves.toBeTruthy();

        const providerPoint3 = await Point.getByAddress('0xProvider');
        expect(providerPoint3).not.toBeUndefined();
        expect(parseFloat(providerPoint3.point)).toEqual(expectedPoints);

        providerRefPoint = await Point.getByAddress('0xProviderRef');
        expect(providerRefPoint).not.toBeUndefined();
        expect(parseFloat(providerRefPoint.point)).toEqual(expectedPoints * ReferrerPointSharePct);
      });
    });
  });

  describe('.grantPoint', () => {
    describe('network has been ignored', () => {
      it('should return false', async () => {
        const event = { transactionHash: '0xHash' } as any;
        cfgObj['app.ignoreNetworkPoint'] = 'ethereum';
        await expect(service.grantPoint('unknown', 'ethereum', '0x1234', event)).resolves.toBeFalsy();
      });
    });

    it('should return false if no point for the given point id', async () => {
      const event = { transactionHash: '0xHash' } as any;
      await expect(service.grantPoint('unknown', '0x123', '0x1234', event)).resolves.toBeFalsy();
    });

    it('should return false if point for the given point id is zero', async () => {
      const event = { transactionHash: '0xHash' } as any;
      await expect(service.grantPoint('test:zero', '0x123', '0x1234', event)).resolves.toBeFalsy();
    });

    it('should create correct point record', async () => {
      const event = { transactionHash: '0xHash' } as any;
      await expect(service.grantPoint('generic', 'ethereum', '0xAddress', event)).resolves.toBeTruthy();
      const point = await Point.getByAddress('0xAddress');
      expect(point).not.toBeUndefined();
      expect(point.network).toEqual('ethereum');
      expect(point.address).toEqual('0xAddress');
      expect(point.point).toEqual('10');
    });

    describe('recipient has a referrer', () => {
      it('should create correct point for referrer', async () => {
        await User.create({ address: '0xAddress', referrer: '0xReferrer' });

        const event = { transactionHash: '0xHash' } as any;
        await expect(service.grantPoint('generic', 'ethereum', '0xAddress', event)).resolves.toBeTruthy();
        const point = await Point.getByAddress('0xAddress');
        expect(point).not.toBeUndefined();
        expect(point.network).toEqual('ethereum');
        expect(point.address).toEqual('0xAddress');
        expect(point.point).toEqual('10');

        const pointRef = await Point.getByAddress('0xReferrer');
        expect(pointRef).not.toBeUndefined();
        expect(pointRef.network).toEqual('ethereum');
        expect(pointRef.address).toEqual('0xReferrer');
        expect(pointRef.referrer).toEqual('0xReferrer');
        expect(pointRef.referee).toEqual('0xAddress');
        expect(pointRef.point).toEqual(toDec(10 * ReferrerPointSharePct).toFixed());
      });
    });
  });
});

import { DBService } from '../db/DBService';
import Swap from './swap';
import * as moment from 'moment';
import Market from './market';

describe('Swap', () => {
  const db = DBService.getForTest();
  const net = 'net1';
  const market = '0xMarket';
  const provider = '0xProvider';
  const payer = '0xPayer';
  const finalizer = '0xFinalizer';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.getVolume', () => {
    it('should return correct volume when `network` is set', async () => {
      await Swap.create({ network: net, marketAddress: '0xMarket', amount: '2' });
      await Swap.create({ network: net, marketAddress: '0xMarket', amount: '1' });
      await Swap.create({ network: 'net2', marketAddress: '0xMarket', amount: '2' });
      expect(await Swap.getVolume(net, undefined, undefined, undefined, undefined, undefined, undefined)).toEqual('3');
    });

    it('should return correct volume when `marketAddress` is set', async () => {
      await Swap.create({ network: net, marketAddress: '0xMarket', amount: '2' });
      await Swap.create({ network: 'net2', marketAddress: '0xMarket2', amount: '2' });
      expect(
        await Swap.getVolume(undefined, '0xMarket2', undefined, undefined, undefined, undefined, undefined),
      ).toEqual('2');
    });

    it('should return correct volume when `baseAddress` is set', async () => {
      await Swap.create({ network: net, baseAddress: '0xBase', amount: '2' });
      await Swap.create({ network: 'net2', baseAddress: '0xBase2', marketAddress: '0xMarket2', amount: '3' });
      expect(await Swap.getVolume(undefined, undefined, '0xBase2', undefined, undefined, undefined, undefined)).toEqual(
        '3',
      );
    });

    it('should return correct volume when `provider` is set', async () => {
      await Swap.create({ network: net, provider: '0xProvider', amount: '2' });
      await Swap.create({ network: 'net2', provider: '0xProvider2', amount: '3' });
      expect(
        await Swap.getVolume(undefined, undefined, undefined, '0xProvider2', undefined, undefined, undefined),
      ).toEqual('3');
    });

    it('should return correct volume when `providerOrTaker` is set', async () => {
      await Swap.create({ network: net, provider: '0xProvider', amount: '2' });
      await Swap.create({ network: 'net2', taker: '0xProvider2', amount: '3' });
      expect(
        await Swap.getVolume(undefined, undefined, undefined, undefined, '0xProvider2', undefined, undefined),
      ).toEqual('3');
      expect(
        await Swap.getVolume(undefined, undefined, undefined, undefined, '0xProvider', undefined, undefined),
      ).toEqual('2');
    });

    it('should return correct volume when `lid` is set', async () => {
      await Swap.create({ network: net, lid: 1, amount: '2' });
      await Swap.create({ network: 'net2', lid: 2, amount: '3' });
      expect(
        await Swap.getVolume(undefined, undefined, undefined, undefined, undefined, 2, undefined, undefined),
      ).toEqual('3');
    });

    it('should return correct volume when `lid` is set', async () => {
      await Swap.create({ network: net, instant: false, amount: '2' });
      await Swap.create({ network: 'net2', instant: true, amount: '3' });
      expect(
        await Swap.getVolume(undefined, undefined, undefined, undefined, undefined, undefined, undefined, true),
      ).toEqual('3');
    });

    it('should return correct volume when `timeAgo` is set', async () => {
      await Swap.create({ network: net, amount: '2', createdAt: moment().subtract(1440, 'minutes').toISOString() });
      await Swap.create({ network: net, amount: '3', createdAt: moment().toISOString() });
      expect(
        await Swap.getVolume(undefined, undefined, undefined, undefined, undefined, undefined, 1440, undefined),
      ).toEqual('3');
    });

    describe('`usd` = true', () => {
      it('should return correct volume when `network` is set', async () => {
        await Swap.create({ network: net, marketAddress: '0xMarket', valueUsd: '2' });
        await Swap.create({ network: net, marketAddress: '0xMarket', valueUsd: '1' });
        await Swap.create({ network: 'net2', marketAddress: '0xMarket', valueUsd: '2' });
        expect(
          await Swap.getVolume(net, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true),
        ).toEqual('3');
      });

      it('should return correct volume when `marketAddress` is set', async () => {
        await Swap.create({ network: net, marketAddress: '0xMarket', valueUsd: '2' });
        await Swap.create({ network: 'net2', marketAddress: '0xMarket2', valueUsd: '3' });
        expect(
          await Swap.getVolume(
            undefined,
            '0xMarket2',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
          ),
        ).toEqual('3');
      });
    });
  });

  describe('.getTopMarketByVolumeUsd', () => {
    beforeEach(async () => {
      await Market.create({ network: net, address: '0xMarket' });
      await Market.create({ network: net, address: '0xMarket2' });
    });

    it('should return correct volume', async () => {
      await Swap.create({ network: net, marketAddress: '0xMarket', valueUsd: '2' });
      await Swap.create({ network: net, marketAddress: '0xMarket2', valueUsd: '1' });
      await Swap.create({ network: net, marketAddress: '0xMarket', valueUsd: '2' });
      const markets = await Swap.getTopMarketBy24hUSDVolume(net, undefined, undefined, undefined, undefined, undefined);
      expect(markets).toHaveLength(2);
      expect(markets[0].address).toEqual('0xMarket');
      expect(markets[0].volume24h).toEqual('4');
      expect(markets[1].address).toEqual('0xMarket2');
      expect(markets[1].volume24h).toEqual('1');
    });
  });

  describe('.getCompletionRate', () => {
    it('should return correct rate', async () => {
      await Swap.create({
        network: net,
        marketAddress: market,
        provider: provider,
        released: true,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider: provider,
        released: true,
        byDispute: true,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider: provider,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider: '0xProvider2',
        released: true,
      });
      expect(await Swap.getCompletionRate(net, market, provider)).toEqual(33.33);
      expect(await Swap.getCompletionRate(net, market, undefined)).toEqual(50);
    });
  });

  describe('.getAvgDuration', function () {
    it('should return correct value', async () => {
      const now = moment();
      await Swap.create({
        network: net,
        marketAddress: market,
        createdAt: now.clone().subtract(5, 's').toISOString(),
        finalizedAt: now.toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 0,
        createdAt: now.clone().subtract(3, 's').toISOString(),
        finalizedAt: now.toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 1,
        createdAt: now.clone().subtract(6, 's').toISOString(),
        finalizedAt: now.toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 1,
        createdAt: now.clone().subtract(8, 's').toISOString(),
        finalizedAt: now.toISOString(),
      });
      expect(await Swap.getAvgFinalizeDuration(net, market, undefined)).toEqual(5.5);
      expect(await Swap.getAvgFinalizeDuration(net, market, provider)).toEqual(5.666666666666667);
      expect(await Swap.getAvgFinalizeDuration(net, market, provider, 1)).toEqual(7);
    });
  });

  describe('.getAvgPaymentDuration', function () {
    it('should return correct value', async () => {
      const now = moment();
      await Swap.create({
        network: net,
        marketAddress: market,
        createdAt: now.clone().subtract(5, 's').toISOString(),
        paidAt: now.toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 1,
        payer,
        createdAt: now.clone().subtract(3, 's').toISOString(),
        paidAt: now.toISOString(),
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 2,
        payer,
        createdAt: now.clone().subtract(6, 's').toISOString(),
        paidAt: now.toISOString(),
      });
      expect(await Swap.getAvgPaymentDuration(net, market, undefined, undefined, undefined)).toEqual(4.666666666666667);
      expect(await Swap.getAvgPaymentDuration(net, market, undefined, undefined, payer)).toEqual(4.5);
      expect(await Swap.getAvgPaymentDuration(net, market, provider, undefined)).toEqual(4.5);
      expect(await Swap.getAvgPaymentDuration(net, market, provider, 1)).toEqual(3);
    });
  });

  describe('.getAvgReleaseDuration', function () {
    it('should return correct value', async () => {
      const now = moment();
      await Swap.create({
        network: net,
        marketAddress: market,
        paidAt: now.clone().subtract(5, 's').toISOString(),
        finalizedAt: now.toISOString(),
        released: false,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 1,
        paidAt: now.clone().subtract(5, 's').toISOString(),
        finalizedAt: now.toISOString(),
        released: true,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        provider,
        lid: 2,
        finalizer,
        paidAt: now.clone().subtract(3, 's').toISOString(),
        finalizedAt: now.toISOString(),
        released: true,
      });
      await Swap.create({
        network: net,
        marketAddress: market,
        lid: 1,
        finalizer,
        paidAt: now.clone().subtract(6, 's').toISOString(),
        finalizedAt: now.toISOString(),
        released: true,
      });
      expect(await Swap.getAvgReleaseDuration(net, market, undefined, undefined, undefined)).toEqual(4.666666666666667);
      expect(await Swap.getAvgReleaseDuration(net, market, undefined, undefined, finalizer)).toEqual(4.5);
      expect(await Swap.getAvgReleaseDuration(net, market, provider, undefined, undefined)).toEqual(4);
      expect(await Swap.getAvgReleaseDuration(net, market, undefined, 1, undefined)).toEqual(5.5);
    });
  });
});

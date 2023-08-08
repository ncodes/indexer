import { DBService } from '../db/DBService';
import Swap from './swap';
import * as moment from 'moment';

describe('MarketPrice', () => {
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

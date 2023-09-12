import { DBService } from '../db/DBService';
import Liquidity from './liquidity';
import * as moment from 'moment';
import BadgeGrant from './badge_grant';
import Market from './market';
import { powOf } from '../network/common';

describe('Liquidity', () => {
  const db = DBService.getForTest();
  const net = 'net1';
  const marketAddress = '0xMarket';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
    await Market.create({
      network: net,
      base: '0xBase',
      quote: '0xQuote',
      address: marketAddress,
      baseDecimals: 18,
      quoteDecimals: 18,
    });
  });

  describe('.search', function () {
    it('should return correct result when `quoteUsdRate` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: '1', price: powOf(1000, 18).toString() });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.4,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].priceUsd).toEqual(400);
    });

    it('should return correct result when `baseUsdRate` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: powOf(1000, 18).toString() });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.4,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].amountUsd).toEqual(400);
    });

    it('should not row when `amount` is zero', async () => {
      await Liquidity.create({ network: net, amount: '0' });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(0);
    });

    it('should not row when `paused` = true', async () => {
      await Liquidity.create({ network: net, amount: '1', paused: true });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(0);
    });

    it('should return correct result when `network` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress: marketAddress, amount: '1' });
      await Liquidity.create({ network: 'net2', amount: '1' });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `marketAddress` is set', async () => {
      const liq = await Liquidity.create({ network: net, amount: '1', marketAddress });
      await Liquidity.create({ network: 'net2', amount: '1', marketAddress: '0xMarket2' });
      const res = await Liquidity.search(
        net,
        '0xMarket',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `provider` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider' });
      await Liquidity.create({ network: 'net2', marketAddress, amount: '1', provider: '0xProvider2' });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        '0xProvider',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `maxOpenDisputes` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: '1', openDisputes: 3 });
      const liq2 = await Liquidity.create({ network: net, marketAddress, amount: '1', openDisputes: 2 });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        3,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);
    });

    it('should return correct result when `amount` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        minSwap: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const liq2 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        minSwap: '10',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      const liq3 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        minSwap: '11',
        updatedAt: moment().subtract(3, 'd').toISOString(),
      });
      let res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '<9',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '>10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq2.id);
      expect(res[1].id).toEqual(liq3.id);
    });

    it('should return correct result when `price` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const liq2 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      const liq3 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '11',
        updatedAt: moment().subtract(3, 'd').toISOString(),
      });
      let res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '<9',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '>10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq2.id);
      expect(res[1].id).toEqual(liq3.id);
    });

    it('should return correct result when `limit` is set', async () => {
      await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const res = await Liquidity.search(
        net,
        marketAddress,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
    });

    it('should return correct result when `offset` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const liq2 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });

      let res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        1,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);
    });

    it('should return correct result when `reqLpBadges` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider' });
      const liq2 = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider2' });
      let res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(0);

      await BadgeGrant.create({ network: net, grantee: '0xProvider', badge: 'kyc', path: 'kyc/usa' });
      await BadgeGrant.create({
        network: net,
        grantee: '0xProvider',
        badge: 'bitcoiner',
        expireAt: moment().subtract(1, 's').toISOString(), // expired
      });
      await BadgeGrant.create({ network: net, grantee: '0xProvider2', badge: 'merchant' });

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc/usa'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc/%'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['bitcoiner'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(0);
    });

    it('should return correct result when `reqSwapBadges` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        provider: '0xProvider',
        requiredSwapBadges: ['kyc'],
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const liq2 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        provider: '0xProvider2',
        requiredSwapBadges: ['merchant'],
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      let res = await Liquidity.search(
        net,
        marketAddress,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc', 'merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['kyc'],
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });
  });
});

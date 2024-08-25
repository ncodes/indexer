import { ChainNames } from '@jointlabs/meta';
import * as moment from 'moment';
import { DBService } from '../db/db.service';
import { powOf } from '../network/common';
import BadgeGrant from './badge_grant';
import Liquidity from './liquidity';
import Market from './market';

describe('Liquidity', () => {
  const db = DBService.getForTest();
  const net: ChainNames = 'ethereum';
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
    it('should return correct result when `hidden` is set', async () => {
      const mkt = await Liquidity.create({ network: net, marketAddress, amount: '1' });
      const mkt2 = await Liquidity.create({ network: net, marketAddress, amount: '1', hidden: true });
      const mkt3 = await Liquidity.create({ network: net, marketAddress, amount: '1', hidden: false });
      let res = await Liquidity.search({ network: net });
      expect(res).toHaveLength(3);

      res = await Liquidity.search({ network: net, hidden: true });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = await Liquidity.search({ network: net, hidden: false });
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt.id);
    });

    it('should return correct result when `quoteUsdRate` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: '1', price: powOf(1000, 18).toString() });
      const res = await Liquidity.search({
        network: net,
        quoteUsdRate: 0.4,
      });
      expect(res).toHaveLength(1);
      expect(res[0].priceUsd).toEqual(400);
    });

    it('should return correct result when `baseUsdRate` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: powOf(1000, 18).toString() });
      const res = await Liquidity.search({
        network: net,
        baseUsdRate: 0.4,
      });
      expect(res).toHaveLength(1);
      expect(res[0].amountUsd).toEqual(400);
    });

    it('should not row when `amount` is zero', async () => {
      await Liquidity.create({ network: net, amount: '0' });
      const res = await Liquidity.search({
        network: net,
      });
      expect(res).toHaveLength(0);
    });

    it('should not row when `paused` = true', async () => {
      await Liquidity.create({ network: net, amount: '1', paused: true });
      const res = await Liquidity.search({
        network: net,
      });
      expect(res).toHaveLength(0);
    });

    it('should return correct result when `network` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress: marketAddress, amount: '1' });
      await Liquidity.create({ network: 'net2', amount: '1' });
      const res = await Liquidity.search({
        network: net,
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `marketAddress` is set', async () => {
      const liq = await Liquidity.create({ network: net, amount: '1', marketAddress });
      await Liquidity.create({ network: 'net2', amount: '1', marketAddress: '0xMarket2' });
      const res = await Liquidity.search({
        network: net,
        marketAddress: '0xMarket',
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `provider` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider' });
      await Liquidity.create({ network: 'net2', marketAddress, amount: '1', provider: '0xProvider2' });
      const res = await Liquidity.search({
        network: net,
        provider: '0xProvider',
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `maxOpenDisputes` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: '1', openDisputes: 3 });
      const liq2 = await Liquidity.create({ network: net, marketAddress, amount: '1', openDisputes: 2 });
      const res = await Liquidity.search({
        network: net,
        maxOpenDisputes: 3,
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);
    });

    it('should return correct result when `maxOpenOrders` is set', async () => {
      await Liquidity.create({ network: net, marketAddress, amount: '1', openOrders: 3 });
      const liq2 = await Liquidity.create({ network: net, marketAddress, amount: '1', openOrders: 2 });
      const res = await Liquidity.search({
        network: net,
        maxOpenOrders: 3,
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);
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
      let res = await Liquidity.search({
        network: net,
        price: '10',
      });
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search({
        network: net,
        price: '<9',
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        price: '>10',
      });
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq2.id);
      expect(res[1].id).toEqual(liq3.id);
    });

    it('should return correct result when `liquidities` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        provider: '0xProvider',
        lid: 1,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      await Liquidity.create({
        network: net,
        marketAddress,
        provider: '0xProvider',
        lid: 2,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const res = await Liquidity.search({
        network: net,
        marketAddress,
        liquidities: [{ marketAddress, provider: '0xProvider', lid: 1 }],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
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
      const res = await Liquidity.search({
        network: net,
        marketAddress,
        limit: 1,
      });
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

      let res = await Liquidity.search({
        network: net,
        limit: 1,
        offset: 0,
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        limit: 1,
        offset: 1,
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);
    });

    it('should return correct result when `reqLpBadges` is set', async () => {
      const liq = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider' });
      const liq2 = await Liquidity.create({ network: net, marketAddress, amount: '1', provider: '0xProvider2' });
      let res = await Liquidity.search({
        network: net,
        reqLpBadges: ['kyc'],
      });
      expect(res).toHaveLength(0);

      await BadgeGrant.create({ network: net, grantee: '0xProvider', badge: 'kyc', path: 'kyc/usa' });
      await BadgeGrant.create({
        network: net,
        grantee: '0xProvider',
        badge: 'bitcoiner',
        expireAt: moment().subtract(1, 's').toISOString(), // expired
      });
      await BadgeGrant.create({ network: net, grantee: '0xProvider2', badge: 'merchant' });

      res = await Liquidity.search({
        network: net,
        reqLpBadges: ['kyc'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        reqLpBadges: ['kyc/usa'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        reqLpBadges: ['kyc/%'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        reqLpBadges: ['merchant'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);

      res = await Liquidity.search({
        network: net,
        reqLpBadges: ['bitcoiner'],
      });
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
      let res = await Liquidity.search({
        network: net,
        marketAddress,
        reqSwapBadges: ['kyc', 'merchant'],
      });
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search({
        network: net,
        reqSwapBadges: ['kyc'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);
    });

    it('should return correct result when `paymentMethods` is set', async () => {
      const liq = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        provider: '0xProvider',
        paymentMethods: ['pm/bank1'],
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const liq2 = await Liquidity.create({
        network: net,
        marketAddress,
        amount: '1',
        provider: '0xProvider2',
        paymentMethods: ['pm/bank2'],
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      let res = await Liquidity.search({
        network: net,
        marketAddress,
        paymentMethods: ['pm/bank1', 'pm/bank2'],
      });
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(liq.id);
      expect(res[1].id).toEqual(liq2.id);

      res = await Liquidity.search({
        network: net,
        paymentMethods: ['pm/bank1'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq.id);

      res = await Liquidity.search({
        network: net,
        paymentMethods: ['pm/bank2'],
      });
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(liq2.id);

      res = await Liquidity.search({
        network: net,
        paymentMethods: ['pm%'],
      });
      expect(res).toHaveLength(2);
    });
  });
});

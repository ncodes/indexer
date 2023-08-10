import { DBService } from '../db/DBService';
import Liquidity from './liquidity';
import * as moment from 'moment';

describe('Liquidity', () => {
  const db = DBService.getForTest();
  const net = 'net1';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.search', function () {
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
      );
      expect(res).toHaveLength(0);
    });

    it('should return correct result when `network` is set', async () => {
      const mkt = await Liquidity.create({ network: net, amount: '1' });
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `marketAddress` is set', async () => {
      const mkt = await Liquidity.create({ network: net, amount: '1', marketAddress: '0xMarket' });
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `provider` is set', async () => {
      const mkt = await Liquidity.create({ network: net, amount: '1', provider: '0xProvider' });
      await Liquidity.create({ network: 'net2', amount: '1', provider: '0xProvider2' });
      const res = await Liquidity.search(
        net,
        undefined,
        '0xProvider',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `maxOpenDisputes` is set', async () => {
      await Liquidity.create({ network: net, amount: '1', openDisputes: 3 });
      const mkt2 = await Liquidity.create({ network: net, amount: '1', openDisputes: 2 });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        3,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `amount` is set', async () => {
      const mkt = await Liquidity.create({
        network: net,
        amount: '1',
        minSwap: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const mkt2 = await Liquidity.create({
        network: net,
        amount: '1',
        minSwap: '10',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      const mkt3 = await Liquidity.create({
        network: net,
        amount: '1',
        minSwap: '11',
        updatedAt: moment().subtract(3, 'd').toISOString(),
      });
      let res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        '10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt.id);
      expect(res[1].id).toEqual(mkt2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        '<9',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        '>10',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt3.id);
    });

    it('should return correct result when `price` is set', async () => {
      const mkt = await Liquidity.create({
        network: net,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const mkt2 = await Liquidity.create({
        network: net,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      const mkt3 = await Liquidity.create({
        network: net,
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
        '10',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt.id);
      expect(res[1].id).toEqual(mkt2.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        '<9',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        '>10',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt3.id);
    });

    it('should return correct result when `limit` is set', async () => {
      await Liquidity.create({
        network: net,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(2, 'd').toISOString(),
      });
      await Liquidity.create({
        network: net,
        amount: '1',
        price: '10',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const res = await Liquidity.search(
        net,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
    });

    it('should return correct result when `offset` is set', async () => {
      const mkt = await Liquidity.create({
        network: net,
        amount: '1',
        price: '9',
        updatedAt: moment().subtract(1, 'd').toISOString(),
      });
      const mkt2 = await Liquidity.create({
        network: net,
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
        1,
        0,
        undefined,
        undefined,
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Liquidity.search(
        net,
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
      expect(res[0].id).toEqual(mkt2.id);
    });
  });
});

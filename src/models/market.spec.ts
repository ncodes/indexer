import { ChainNames } from '@jointlabs/chains-info';
import { DBService } from '../db/db.service';
import Market from './market';

describe('Market', () => {
  const db = DBService.getForTest();
  const net: ChainNames = 'ethereum';

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
    it('should return correct result when `network` is set', async () => {
      const mkt = await Market.create({ network: net, totalLiquidity: '1' });
      await Market.create({ network: 'localhost' });
      const res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `creator` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', creator: '0xCreator' });
      await Market.create({ totalLiquidity: '1', creator: '0xCreator2' });
      const res = (await Market.search(
        undefined,
        '0xCreator',
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
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `address` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', address: '0xAddress' });
      await Market.create({ totalLiquidity: '1', address: '0xAddress2' });
      const res = (await Market.search(
        undefined,
        undefined,
        ['0xAddress'],
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
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `base` is set', async () => {
      await Market.create({ totalLiquidity: '1', baseAddress: '0xBase', base: 'BASE' });
      await Market.create({ totalLiquidity: '1', baseAddress: '0xBase', base: 'BAZE' });
      let res = (await Market.search(
        undefined,
        undefined,
        undefined,
        '0xBase',
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
      )) as Market[];
      expect(res).toHaveLength(2);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        'BAZE',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].base).toEqual('BAZE');
    });

    it('should return correct result when `quote` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', quoteAddress: '0xQuote', quote: 'QUOTE' });
      const mkt2 = await Market.create({ totalLiquidity: '1', quoteAddress: '0xQuote2', quote: 'QUOTE2' });
      let res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        '0xQuote',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        'QUOTE2',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `queryStr` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', base: 'BTC', quoteAddress: '0xQuote' });
      await Market.create({ totalLiquidity: '1', quoteAddress: '0xQuote2' });
      const res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'BTC',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `price` is set', async () => {
      const mkt = await Market.create({ lowestPrice: '9' });
      const mkt2 = await Market.create({ lowestPrice: '10' });
      const mkt3 = await Market.create({ lowestPrice: '11' });
      let res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '<10',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `priceUsd` is set', async () => {
      const mkt = await Market.create({ quoteDecimals: 0, lowestPrice: '9' }); // 4.5
      const mkt2 = await Market.create({ quoteDecimals: 0, lowestPrice: '10' }); // 5.0
      const mkt3 = await Market.create({ quoteDecimals: 0, lowestPrice: '11' }); // 5.5
      let res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        '4.5',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        '<5.0',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        '>5.0',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `liquidity` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '9' });
      const mkt2 = await Market.create({ totalLiquidity: '10' });
      const mkt3 = await Market.create({ totalLiquidity: '11' });
      let res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '<10',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `liquidityUsd` is set', async () => {
      const mkt = await Market.create({ quoteDecimals: 0, totalLiquidity: '9' }); // 4.5
      const mkt2 = await Market.create({ quoteDecimals: 0, totalLiquidity: '10' }); // 5.0
      const mkt3 = await Market.create({ quoteDecimals: 0, totalLiquidity: '11' }); // 5.5
      let res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        undefined,
        undefined,
        '4.5',
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        undefined,
        undefined,
        '<5.0',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0.5,
        undefined,
        undefined,
        '>5.0',
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
      )) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `permSwap` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', permSwap: false });
      const mkt2 = await Market.create({ totalLiquidity: '1', permSwap: true });
      let res = (await Market.search(
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
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `permPut` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', permPut: false });
      const mkt2 = await Market.create({ totalLiquidity: '1', permPut: true });
      let res = (await Market.search(
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
        false,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        true,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `instant` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', instant: true });
      const mkt2 = await Market.create({ totalLiquidity: '1', instant: false });
      let res = (await Market.search(
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
        true,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        false,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `countOnly` is set', async () => {
      await Market.create({ totalLiquidity: '1', amountSwapped: '2' });
      await Market.create({ totalLiquidity: '1', amountSwapped: '1' });
      const res = (await Market.search(
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
        undefined,
        true,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toEqual('2');
    });

    it('should return correct result when `limit` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', amountSwapped: '2' });
      await Market.create({ totalLiquidity: '1', amountSwapped: '1' });
      let res = (await Market.search(
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
        undefined,
        undefined,
        1,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        2,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `offset` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', amountSwapped: '2' });
      const mkt2 = await Market.create({ totalLiquidity: '1', amountSwapped: '1' });
      let res = (await Market.search(
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
        undefined,
        undefined,
        1,
        0,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        1,
        1,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `regions` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', regions: ['region/nga', 'region/europe'] });
      const mkt2 = await Market.create({ totalLiquidity: '1', regions: ['region/asia'] });
      let res = (await Market.search(
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
        ['region/nga'],
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        ['region/europe'],
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
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        ['region/asia'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        ['region/nga', 'region/asia'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);

      res = (await Market.search(
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
        ['region%'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `reqSwapBadges` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', requiredSwapBadges: ['merchant'] });
      const mkt2 = await Market.create({ totalLiquidity: '1', requiredSwapBadges: ['bitcoiner'] });
      let res = (await Market.search(
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
        ['merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        ['bitcoiner'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        ['bitcoiner', 'merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `reqPutBadges` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', requiredPutBadges: ['merchant'] });
      const mkt2 = await Market.create({ totalLiquidity: '1', requiredPutBadges: ['bitcoiner'] });
      let res = (await Market.search(
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
        ['merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        ['bitcoiner'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        ['bitcoiner', 'merchant'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `offer` is set', async () => {
      const mkt = await Market.create({ totalLiquidity: '1', offerOnly: true });
      const mkt2 = await Market.create({ totalLiquidity: '1', offerOnly: false });
      let res = (await Market.search(
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
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search(
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
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search(
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
        undefined,
        undefined,
        undefined,
        undefined,
      )) as Market[];
      expect(res).toHaveLength(2);
    });
  });
});

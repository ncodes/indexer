import { ChainNames } from '@jointlabs/chains-info';
import { DBService } from '../db/db.service';
import { powOf } from '../network/common';
import Liquidity from './liquidity';
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

  describe('.getById', () => {
    it('should successfully get market by ID', async () => {
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(4, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(5, 18).toString() });
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',
        baseDecimals: 18,
      });
      const mkt2 = await Market.create({ network: 'ethereum', address: '0xMarket2', baseDecimals: 18 });

      let res = await Market.getById(mkt.id);
      expect(res).toBeDefined();
      expect(res?.id).toEqual(mkt.id);
      expect(res.totalLiquidity).toEqual(powOf(9, 18).toString());

      res = await Market.getById(mkt2.id);
      expect(res).toBeDefined();
      expect(res?.id).toEqual(mkt2.id);
      expect(res.totalLiquidity).toEqual('0');

      res = await Market.getById('invalid');
      expect(res).toBeUndefined();
    });
  });

  describe('.search', function () {
    it('should return correct result when `network` is set', async () => {
      const mkt = await Market.create({ address: '0xMarket', network: net });
      await Market.create({ address: '0xMarket', network: 'localhost' });
      const res = (await Market.search({
        network: net,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `creator` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        creator: '0xCreator',
      });
      await Market.create({ network: 'ethereum', address: '0xMarket2', creator: '0xCreator2' });
      const res = (await Market.search({
        creator: '0xCreator',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `address` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xAddress',
      });
      await Market.create({ network: 'ethereum', address: '0xAddress2' });
      const res = (await Market.search({
        address: ['0xAddress'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `base` is set', async () => {
      await Market.create({
        network: 'ethereum',
        address: '0xMarket',
        baseAddress: '0xBase',
        base: 'BASE',
      });
      await Market.create({
        network: 'ethereum',
        address: '0xMarket2',
        baseAddress: '0xBase',
        base: 'BAZE',
      });
      let res = (await Market.search({
        base: '0xBase',
      })) as Market[];
      expect(res).toHaveLength(2);

      res = (await Market.search({
        base: 'BAZE',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].base).toEqual('BAZE');
    });

    it('should return correct result when `quote` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',
        quoteAddress: '0xQuote',
        quote: 'QUOTE',
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',
        quoteAddress: '0xQuote2',
        quote: 'QUOTE2',
      });
      let res = (await Market.search({
        quote: '0xQuote',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        quote: 'QUOTE2',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `queryStr` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',
        base: 'BTC',
        quoteAddress: '0xQuote',
      });
      await Market.create({ network: 'ethereum', address: '0xMarket2', quoteAddress: '0xQuote2' });
      const res = (await Market.search({
        queryStr: 'BTC',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `price` is set', async () => {
      const mkt = await Market.create({ network: 'ethereum', address: '0xMarket', lowestPrice: '9' });
      const mkt2 = await Market.create({ network: 'ethereum', address: '0xMarket2', lowestPrice: '10' });
      const mkt3 = await Market.create({ network: 'ethereum', address: '0xMarket3', lowestPrice: '11' });
      let res = (await Market.search({
        price: '10',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        price: '<10',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        price: '>10',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `priceUsd` is set', async () => {
      const mkt = await Market.create({ network: 'ethereum', address: '0xMarket', quoteDecimals: 0, lowestPrice: '9' }); // 4.5
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',
        quoteDecimals: 0,
        lowestPrice: '10',
      }); // 5.0
      const mkt3 = await Market.create({
        network: 'ethereum',
        address: '0xMarket3',
        quoteDecimals: 0,
        lowestPrice: '11',
      }); // 5.5
      let res = (await Market.search({
        quoteUsdRate: 0.5,
        priceUsd: '4.5',
      })) as Market[];

      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        quoteUsdRate: 0.5,
        priceUsd: '<5.0',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        quoteUsdRate: 0.5,
        priceUsd: '>5.0',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt3.id);
      expect(res[1].id).toEqual(mkt2.id);
    });

    it('should return correct result when `liquidity` is set', async () => {
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(4, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(5, 18).toString() });
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',
        baseDecimals: 18,
      });

      await Liquidity.create({ network: 'sepolia', marketAddress: '0xMarket2', amount: powOf(4, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket2', amount: powOf(5, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket2', amount: powOf(1, 18).toString() });
      const mkt2 = await Market.create({ network: 'ethereum', address: '0xMarket2', baseDecimals: 18 });

      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket3', amount: powOf(5, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket3', amount: powOf(6, 18).toString() });
      const mkt3 = await Market.create({ network: 'ethereum', address: '0xMarket3', baseDecimals: 18 });

      let res = (await Market.search({
        liquidity: powOf(10, 18).toString(),
        baseUsdRate: 2.5,
      })) as Market[];

      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        liquidity: `<${powOf(10, 18).toString()}`,
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        liquidity: `>${powOf(10, 18).toString()}`,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt3.id);
    });

    it('should return correct result when `liquidityUsd` is set', async () => {
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(4, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket', amount: powOf(5, 18).toString() });
      const mkt = await Market.create({ network: 'ethereum', address: '0xMarket', baseDecimals: 18 });

      await Liquidity.create({ network: 'sepolia', marketAddress: '0xMarket2', amount: powOf(4, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket2', amount: powOf(5, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket2', amount: powOf(1, 18).toString() });
      const mkt2 = await Market.create({ network: 'ethereum', address: '0xMarket2', baseDecimals: 18 });

      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket3', amount: powOf(5, 18).toString() });
      await Liquidity.create({ network: 'ethereum', marketAddress: '0xMarket3', amount: powOf(6, 18).toString() });
      const mkt3 = await Market.create({ network: 'ethereum', address: '0xMarket3', baseDecimals: 18 });

      let res = (await Market.search({
        baseUsdRate: 0.5,
        liquidityUsd: '4.5',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        baseUsdRate: 0.5,
        liquidityUsd: '<5.0',
      })) as Market[];
      expect(res).toHaveLength(2);
      expect(res[0].id).toEqual(mkt2.id);
      expect(res[1].id).toEqual(mkt.id);

      res = (await Market.search({
        baseUsdRate: 0.5,
        liquidityUsd: '>5.0',
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt3.id);
    });

    it('should return correct result when `permSwap` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        permSwap: false,
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        permSwap: true,
      });
      let res = (await Market.search({
        permSwap: false,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        permSwap: true,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({})) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `permPut` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        permPut: false,
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        permPut: true,
      });
      let res = (await Market.search({
        permPut: false,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        permPut: true,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({})) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `instant` is set', async () => {
      const mkt = await Market.create({ network: 'ethereum', address: '0xMarket', instant: true });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        instant: false,
      });
      let res = (await Market.search({
        instant: true,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        instant: false,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `countOnly` is set', async () => {
      await Market.create({ network: 'ethereum', address: '0xMarket', amountSwapped: '2' });
      await Market.create({ network: 'ethereum', address: '0xMarket2', amountSwapped: '1' });
      const res = (await Market.search({
        countOnly: true,
      })) as Market[];
      expect(res).toEqual('2');
    });

    it('should return correct result when `limit` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        amountSwapped: '2',
      });
      await Market.create({ network: 'ethereum', address: '0xMarket2', amountSwapped: '1' });
      let res = (await Market.search({
        limit: 1,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        limit: 2,
      })) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `offset` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        amountSwapped: '2',
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        amountSwapped: '1',
      });
      let res = (await Market.search({
        limit: 1,
        offset: 0,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        limit: 1,
        offset: 1,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `regions` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        regions: ['region/nga', 'region/europe'],
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        regions: ['region/asia'],
      });
      let res = (await Market.search({
        regions: ['region/nga'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        regions: ['region/europe'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        regions: ['region/asia'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({
        regions: ['region/nga', 'region/asia'],
      })) as Market[];
      expect(res).toHaveLength(2);

      res = (await Market.search({
        regions: ['region%'],
      })) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `reqSwapBadges` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        requiredSwapBadges: ['merchant'],
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        requiredSwapBadges: ['bitcoiner'],
      });
      let res = (await Market.search({
        reqSwapBadges: ['merchant'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        reqSwapBadges: ['bitcoiner'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({
        reqSwapBadges: ['bitcoiner', 'merchant'],
      })) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `reqPutBadges` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        requiredPutBadges: ['merchant'],
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',

        requiredPutBadges: ['bitcoiner'],
      });
      let res = (await Market.search({
        reqPutBadges: ['merchant'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        reqPutBadges: ['bitcoiner'],
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({
        reqPutBadges: ['bitcoiner', 'merchant'],
      })) as Market[];
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `offer` is set', async () => {
      const mkt = await Market.create({
        network: 'ethereum',
        address: '0xMarket',

        offerOnly: true,
      });
      const mkt2 = await Market.create({
        network: 'ethereum',
        address: '0xMarket2',
        offerOnly: false,
      });
      let res = (await Market.search({
        offer: true,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = (await Market.search({
        offer: false,
      })) as Market[];
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = (await Market.search({})) as Market[];
      expect(res).toHaveLength(2);
    });
  });
});

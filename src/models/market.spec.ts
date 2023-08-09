import { DBService } from '../db/DBService';
import Swap from './swap';
import * as moment from 'moment';
import Market from './market';

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

  describe('.search', function () {
    it('should return correct result when `network` is set', async () => {
      const mkt = await Market.create({ network: net });
      await Market.create({ network: 'net2' });
      const res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `creator` is set', async () => {
      const mkt = await Market.create({ creator: '0xCreator' });
      await Market.create({ creator: '0xCreator2' });
      const res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `baseAsset` is set', async () => {
      const mkt = await Market.create({ baseAddress: '0xBase' });
      await Market.create({ baseAddress: '0xBase' });
      const res = await Market.search(
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
      );
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `quoteAsset` is set', async () => {
      const mkt = await Market.create({ quoteAddress: '0xQuote' });
      await Market.create({ quoteAddress: '0xQuote2' });
      const res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `queryStr` is set', async () => {
      const mkt = await Market.create({ base: 'BTC', quoteAddress: '0xQuote' });
      await Market.create({ quoteAddress: '0xQuote2' });
      const res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);
    });

    it('should return correct result when `noPermSwap` is set', async () => {
      const mkt = await Market.create({ permSwap: false });
      const mkt2 = await Market.create({ permSwap: true });
      let res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);

      res = await Market.search(
        undefined,
        undefined,
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
    });

    it('should return correct result when `onlyInstant` is set', async () => {
      const mkt = await Market.create({ instant: true });
      const mkt2 = await Market.create({ instant: false });
      let res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });

    it('should return correct result when `countOnly` is set', async () => {
      await Market.create({ amountSwapped: '2' });
      await Market.create({ amountSwapped: '1' });
      const res = await Market.search(
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
      );
      expect(res).toEqual('2');
    });

    it('should return correct result when `limit` is set', async () => {
      const mkt = await Market.create({ amountSwapped: '2' });
      await Market.create({ amountSwapped: '1' });
      let res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Market.search(
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
      );
      expect(res).toHaveLength(2);
    });

    it('should return correct result when `offset` is set', async () => {
      const mkt = await Market.create({ amountSwapped: '2' });
      const mkt2 = await Market.create({ amountSwapped: '1' });
      let res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt.id);

      res = await Market.search(
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
      );
      expect(res).toHaveLength(1);
      expect(res[0].id).toEqual(mkt2.id);
    });
  });
});
